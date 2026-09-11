import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from qvac_mesh_shared import (
    AnalyticsSummary,
    CaptureTurnRequest,
    CaptureTurnResponse,
    ConfidenceLevel,
    CustomerSummary,
    EquipmentObservation,
    NaturalLanguageQueryRequest,
    NaturalLanguageQueryResponse,
    ObservationStatus,
)
from qvac_mesh_shared.config import NodeSettings

from . import auth, extraction
from .schemas import (
    ExtractRequest,
    ExtractionResultSchema,
    PhotoRecord,
    PhotoValidateRequest,
    RegisterTechnicianRequest,
    RegisterTechnicianResponse,
    RosterResponse,
    SyncAcceptedItem,
    SyncRequest,
    SyncResponse,
    TechnicianAuthRequest,
    TechnicianAuthResponse,
    TechnicianSummary,
)
from .seed_data import SEED_OBSERVATIONS
from .sessions import sessions
from .store import Store

logger = logging.getLogger("installed_base.main")

settings = NodeSettings()
DB_PATH = os.environ.get("INSTALLED_BASE_DB_PATH", "/data/installed_base.db")
MEDIA_DIR = os.environ.get("INSTALLED_BASE_MEDIA_DIR", "/data/media")
PHOTO_QUEUE_POLL_SECONDS = 3
# Off for a live demo against a real client node -- the Customer 360 /
# analytics views should only ever show what technicians actually reported,
# never the fictional dataset. On by default so a fresh clone still has data
# to look at without anyone submitting an observation first.
SEED_DEMO_DATA = os.environ.get("SEED_DEMO_DATA", "true").lower() != "false"

store: Store | None = None


async def _photo_processing_loop() -> None:
    while True:
        await asyncio.sleep(PHOTO_QUEUE_POLL_SECONDS)
        photo = store.next_pending_photo() if store else None
        if not photo:
            continue
        try:
            guess = await extraction.identify_photo(settings.router_url, photo["photo_path"])
            store.mark_photo_needs_review(
                photo["id"], guess.get("modality"), guess.get("brand"), guess.get("model"), guess.get("confidence")
            )
        except Exception:
            logger.warning("Photo %s identification failed", photo["id"], exc_info=True)
            store.mark_photo_failed(photo["id"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    global store
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    os.makedirs(os.path.join(MEDIA_DIR, "photos"), exist_ok=True)
    os.makedirs(os.path.join(MEDIA_DIR, "audio"), exist_ok=True)
    store = Store(DB_PATH)
    if store.is_empty() and SEED_DEMO_DATA:
        store.seed(SEED_OBSERVATIONS)
        logger.info("Seeded %d demo observations", len(SEED_OBSERVATIONS))
    auth.set_store(store)
    photo_task = asyncio.create_task(_photo_processing_loop())
    yield
    photo_task.cancel()


app = FastAPI(title="Customer Installed Base Intelligence", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _safe_confidence(value: str | None) -> ConfidenceLevel:
    try:
        return ConfidenceLevel(value)
    except (ValueError, TypeError):
        return ConfidenceLevel.LOW


def _safe_status(value: str | None) -> ObservationStatus:
    try:
        return ObservationStatus(value)
    except (ValueError, TypeError):
        return ObservationStatus.UNKNOWN


def _build_observations(extracted: dict, observer: str, source: str) -> list[EquipmentObservation]:
    customer = extracted.get("customer")
    if not customer:
        return []
    observations = []
    for item in extracted.get("equipment", []):
        observations.append(
            EquipmentObservation(
                customer=customer,
                city=extracted.get("city"),
                country=extracted.get("country"),
                modality=item.get("modality", "Unknown"),
                quantity=item.get("quantity"),
                brand=item.get("brand"),
                model=item.get("model"),
                approx_age_years=item.get("approx_age_years"),
                confidence=_safe_confidence(item.get("confidence")),
                status=_safe_status(item.get("status")),
                source=source,
                observer=observer,
                visit_date=date.today().isoformat(),
            )
        )
    return observations


def _summarize(observations: list[EquipmentObservation]) -> str:
    parts = [f"{o.quantity or '?'}x {o.modality}" + (f" ({o.brand})" if o.brand else "") for o in observations]
    customer = observations[0].customer
    dup_ids = sorted({d for o in observations for d in o.possible_duplicate_of})
    summary = f"Guardado para {customer}: " + ", ".join(parts) + "."
    if dup_ids:
        summary += f" Nota: posible duplicado de observacion(es) existente(s) #{dup_ids}."
    return summary


async def _run_turn(session_id_in: str | None, text: str, source: str, observer: str) -> CaptureTurnResponse:
    session_id, session = sessions.get_or_create(session_id_in)
    session.transcript.append(text)

    try:
        extracted = await extraction.extract_from_transcript(settings.router_url, session.transcript)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if extracted.get("ready_to_save") and extracted.get("equipment"):
        observations = _build_observations(extracted, observer, source)
        if not observations:
            return CaptureTurnResponse(
                session_id=session_id,
                agent_message="Which hospital or customer is this for?",
                done=False,
            )
        saved = [store.insert(obs) for obs in observations]
        sessions.clear(session_id)
        return CaptureTurnResponse(
            session_id=session_id,
            agent_message=_summarize(saved),
            saved_observations=saved,
            done=True,
        )

    follow_up = extracted.get("follow_up_question") or "Could you share more detail about the equipment you saw?"
    return CaptureTurnResponse(session_id=session_id, agent_message=follow_up, done=False)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "router_url": settings.router_url}


@app.post("/auth/technician", response_model=TechnicianAuthResponse)
async def authenticate(request: TechnicianAuthRequest) -> TechnicianAuthResponse:
    resolved = auth.authenticate_pin(request.pin)
    if resolved is None:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    technician_id, name = resolved
    token = auth.tokens.issue(technician_id, name)
    return TechnicianAuthResponse(token=token, technician_id=technician_id, name=name)


@app.get("/auth/roster", response_model=RosterResponse)
async def auth_roster(technician: tuple[str, str] = Depends(auth.get_current_technician)) -> RosterResponse:
    """PIN hashes + pepper for the technician app's offline-login cache.
    Requires a valid token, so only someone who already logged in online at
    least once can pull it -- refresh this right after login and whenever
    the app is online, not on-demand when already offline."""
    return RosterResponse.model_validate(auth.list_roster())


@app.post("/technicians", response_model=RegisterTechnicianResponse)
async def register_technician(request: RegisterTechnicianRequest) -> RegisterTechnicianResponse:
    """Frontend admin view calls this to add a technician. No admin auth of
    its own (see auth.py's module docstring) -- anyone who can reach this
    service can register one, an accepted MVP simplification. Once
    registered, the technician's own phone picks up the new PIN the next
    time it hits GET /auth/roster (right after its own login, or whenever
    SyncScreen finds the server online) -- no separate "push" step needed."""
    try:
        technician_id, name = auth.register_technician(request.name, request.pin)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RegisterTechnicianResponse(technician_id=technician_id, name=name)


@app.get("/technicians", response_model=list[TechnicianSummary])
async def list_technicians() -> list[TechnicianSummary]:
    """Backs the frontend's technician admin view -- who's registered, and
    last_seen_at (bumped on every authenticated request, see
    auth.get_current_technician) as a real signal of which phones are
    actually talking to this node, not just who exists."""
    return [TechnicianSummary.model_validate(t) for t in auth.list_technicians()]


@app.post("/capture/turn", response_model=CaptureTurnResponse)
async def capture_turn(
    request: CaptureTurnRequest, technician: tuple[str, str] = Depends(auth.get_current_technician)
) -> CaptureTurnResponse:
    if request.client_event_id:
        cached = store.get_cached_response(request.client_event_id)
        if cached is not None:
            return CaptureTurnResponse.model_validate(cached)

    _, name = technician
    response = await _run_turn(request.session_id, request.text, "text", name)

    if request.client_event_id:
        store.cache_response(request.client_event_id, response.model_dump(mode="json"))
    return response


@app.post("/extract", response_model=ExtractionResultSchema)
async def extract(
    request: ExtractRequest, technician: tuple[str, str] = Depends(auth.get_current_technician)
) -> ExtractionResultSchema:
    """Stateless counterpart to the technician app's on-device extraction.
    When the phone is online, it sends its own transcript here instead of
    running locally -- same Router-mediated extraction /capture/turn uses,
    just without any session/save side effects, since the app already owns
    all of that itself. Which peer actually answers (and therefore how big
    a model this runs) is whatever the Router has registered for
    "completion" -- see docs/multi-host-demo.md for pointing this node's
    peer at a bigger model than the phone can run."""
    try:
        extracted = await extraction.extract_from_transcript(settings.router_url, request.transcript)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    auth.mark_used_remote_extraction(technician[0])
    return ExtractionResultSchema.model_validate(extracted)


@app.post("/capture/turn/voice", response_model=CaptureTurnResponse)
async def capture_turn_voice(
    audio: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    client_event_id: str | None = Form(default=None),
    technician: tuple[str, str] = Depends(auth.get_current_technician),
) -> CaptureTurnResponse:
    if client_event_id:
        cached = store.get_cached_response(client_event_id)
        if cached is not None:
            return CaptureTurnResponse.model_validate(cached)

    audio_path = os.path.join(MEDIA_DIR, "audio", f"{uuid.uuid4()}.wav")
    with open(audio_path, "wb") as f:
        f.write(await audio.read())

    try:
        text = await extraction.transcribe_audio(settings.router_url, audio_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    _, name = technician
    response = await _run_turn(session_id, text, "voice", name)

    if client_event_id:
        store.cache_response(client_event_id, response.model_dump(mode="json"))
    return response


@app.post("/photos", response_model=PhotoRecord)
async def upload_photo(
    photo: UploadFile = File(...),
    customer: str | None = Form(default=None),
    technician: tuple[str, str] = Depends(auth.get_current_technician),
) -> PhotoRecord:
    technician_id, _ = technician
    photo_path = os.path.join(MEDIA_DIR, "photos", f"{uuid.uuid4()}.jpg")
    with open(photo_path, "wb") as f:
        f.write(await photo.read())
    record = store.insert_photo(photo_path, customer, technician_id)
    return PhotoRecord.model_validate(record)


@app.get("/photos", response_model=list[PhotoRecord])
async def list_photos(status: str | None = None) -> list[PhotoRecord]:
    return [PhotoRecord.model_validate(p) for p in store.list_photos(status)]


@app.post("/photos/{photo_id}/validate", response_model=EquipmentObservation)
async def validate_photo(
    photo_id: int,
    request: PhotoValidateRequest,
    technician: tuple[str, str] = Depends(auth.get_current_technician),
) -> EquipmentObservation:
    if request.client_event_id:
        cached = store.get_cached_response(request.client_event_id)
        if cached is not None:
            return EquipmentObservation.model_validate(cached)

    photo = store.get_photo(photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail=f"Photo {photo_id} not found")
    if photo["status"] not in ("needs_review",):
        raise HTTPException(status_code=400, detail=f"Photo {photo_id} is not awaiting review (status={photo['status']})")
    if not photo["customer"]:
        raise HTTPException(status_code=400, detail="Photo has no customer associated -- pass one on upload")

    _, name = technician
    if request.confirmed:
        modality, brand, model_ = photo["guessed_modality"], photo["guessed_brand"], photo["guessed_model"]
        corrected_label = None
    else:
        if not request.correction:
            raise HTTPException(status_code=400, detail="confirmed=false requires a correction")
        modality, brand, model_ = request.correction.modality, request.correction.brand, request.correction.model
        corrected_label = modality

    observation = store.insert(
        EquipmentObservation(
            customer=photo["customer"],
            modality=modality or "Unknown",
            brand=brand,
            model=model_,
            confidence=ConfidenceLevel.HIGH,  # a human validated it
            status=ObservationStatus.CONFIRMED,
            source="photo",
            observer=name,
            visit_date=date.today().isoformat(),
        )
    )
    store.resolve_photo(photo_id, request.confirmed, corrected_label, observation.id)

    if request.client_event_id:
        store.cache_response(request.client_event_id, observation.model_dump(mode="json"))
    return observation


@app.post("/sync", response_model=SyncResponse)
async def sync(
    request: SyncRequest, technician: tuple[str, str] = Depends(auth.get_current_technician)
) -> SyncResponse:
    """Batch-accepts the technician app's offline SQLite queue. Equipment is
    already structured (extracted on-device before saving locally), so this
    just persists it -- no Router/extraction call needed. Idempotent per
    (technician, local_id): a retried sync after a dropped connection replays
    the same accepted ids instead of duplicating observations."""
    _, name = technician
    accepted: list[SyncAcceptedItem] = []
    for item in request.pending_observations:
        client_event_id = f"mobile-sync-{name}-{item.local_id}"
        cached = store.get_cached_response(client_event_id)
        if cached is not None:
            accepted.append(SyncAcceptedItem(local_id=item.local_id, observation_id=cached["observation_id"]))
            continue

        observation = store.insert(
            EquipmentObservation(
                customer=item.customer,
                city=item.city,
                country=item.country,
                modality=item.modality,
                quantity=item.quantity,
                brand=item.brand,
                model=item.model,
                approx_age_years=item.approx_age_years,
                confidence=_safe_confidence(item.confidence),
                status=_safe_status(item.status),
                source=item.source,
                observer=name,
                visit_date=item.visit_date,
            )
        )
        store.cache_response(client_event_id, {"observation_id": observation.id})
        accepted.append(SyncAcceptedItem(local_id=item.local_id, observation_id=observation.id))

    return SyncResponse(accepted=accepted)


@app.get("/customers", response_model=list[CustomerSummary])
async def list_customers() -> list[CustomerSummary]:
    return store.list_customers_summary()


@app.get("/customers/{customer}", response_model=list[EquipmentObservation])
async def customer_detail(customer: str) -> list[EquipmentObservation]:
    observations = store.list_by_customer(customer)
    if not observations:
        raise HTTPException(status_code=404, detail=f"No observations found for '{customer}'")
    return observations


@app.get("/analytics", response_model=AnalyticsSummary)
async def analytics() -> AnalyticsSummary:
    return store.compute_analytics()


@app.post("/query", response_model=NaturalLanguageQueryResponse)
async def query(request: NaturalLanguageQueryRequest) -> NaturalLanguageQueryResponse:
    try:
        filters = await extraction.interpret_query(settings.router_url, request.question)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    results = store.list_all()
    if country := filters.get("country"):
        results = [o for o in results if o.country and o.country.lower() == country.lower()]
    if modality := filters.get("modality"):
        results = [o for o in results if o.modality.lower() == modality.lower()]
    if (min_age := filters.get("min_age_years")) is not None:
        results = [o for o in results if o.approx_age_years is not None and o.approx_age_years >= min_age]
    if (max_age := filters.get("max_age_years")) is not None:
        results = [o for o in results if o.approx_age_years is not None and o.approx_age_years <= max_age]
    if status := filters.get("status"):
        results = [o for o in results if o.status.value == status.lower()]
    if confidence := filters.get("confidence"):
        results = [o for o in results if o.confidence.value == confidence.lower()]

    return NaturalLanguageQueryResponse(question=request.question, interpreted_filter=filters, results=results)

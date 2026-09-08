import logging
import os
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from qvac_mesh_shared import (
    AnalyticsSummary,
    CaptureTurnRequest,
    CaptureTurnResponse,
    ConfidenceLevel,
    CustomerSummary,
    EquipmentObservation,
    ObservationStatus,
)
from qvac_mesh_shared.config import NodeSettings

from . import extraction
from .seed_data import SEED_OBSERVATIONS
from .sessions import sessions
from .store import Store

logger = logging.getLogger("installed_base.main")

settings = NodeSettings()
DB_PATH = os.environ.get("INSTALLED_BASE_DB_PATH", "/data/installed_base.db")

store: Store | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global store
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    store = Store(DB_PATH)
    if store.is_empty():
        store.seed(SEED_OBSERVATIONS)
        logger.info("Seeded %d demo observations", len(SEED_OBSERVATIONS))
    yield


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


def _build_observations(extracted: dict) -> list[EquipmentObservation]:
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
                source="text",
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "router_url": settings.router_url}


@app.post("/capture/turn", response_model=CaptureTurnResponse)
async def capture_turn(request: CaptureTurnRequest) -> CaptureTurnResponse:
    session_id, session = sessions.get_or_create(request.session_id)
    session.transcript.append(request.text)

    try:
        extracted = await extraction.extract_from_transcript(settings.router_url, session.transcript)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if extracted.get("ready_to_save") and extracted.get("equipment"):
        observations = _build_observations(extracted)
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

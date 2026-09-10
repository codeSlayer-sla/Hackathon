"""Request/response shapes local to this service (not shared with other
services, unlike qvac_mesh_shared) -- auth and the photo review queue."""

from __future__ import annotations

from pydantic import BaseModel


class TechnicianAuthRequest(BaseModel):
    pin: str


class TechnicianAuthResponse(BaseModel):
    token: str
    technician_id: str
    name: str


class RegisterTechnicianRequest(BaseModel):
    name: str
    pin: str


class RegisterTechnicianResponse(BaseModel):
    technician_id: str
    name: str


class TechnicianSummary(BaseModel):
    """Never includes a PIN or its hash -- this is what the frontend's
    admin view lists, not what the mobile app syncs (see RosterResponse)."""

    technician_id: str
    name: str
    created_at: str
    last_seen_at: str | None = None


class PhotoRecord(BaseModel):
    id: int
    photo_path: str
    customer: str | None = None
    technician_id: str | None = None
    status: str
    guessed_modality: str | None = None
    guessed_brand: str | None = None
    guessed_model: str | None = None
    guessed_confidence: str | None = None
    corrected_label: str | None = None
    linked_observation_id: int | None = None
    created_at: str
    processed_at: str | None = None


class PhotoCorrection(BaseModel):
    modality: str
    brand: str | None = None
    model: str | None = None


class PhotoValidateRequest(BaseModel):
    confirmed: bool
    correction: PhotoCorrection | None = None
    client_event_id: str | None = None


class SyncObservationItem(BaseModel):
    """One row from the technician app's local SQLite queue, already
    structured by the on-device extraction -- no LLM call needed here."""

    local_id: int
    customer: str
    city: str | None = None
    country: str | None = None
    modality: str
    quantity: int | None = None
    brand: str | None = None
    model: str | None = None
    approx_age_years: float | None = None
    confidence: str
    status: str
    source: str
    observer: str
    visit_date: str


class SyncRequest(BaseModel):
    pending_observations: list[SyncObservationItem]


class SyncAcceptedItem(BaseModel):
    local_id: int
    observation_id: int


class SyncResponse(BaseModel):
    accepted: list[SyncAcceptedItem]


class RosterEntry(BaseModel):
    technician_id: str
    name: str
    pin_hash: str


class RosterResponse(BaseModel):
    pepper: str
    technicians: list[RosterEntry]


class ExtractRequest(BaseModel):
    """Stateless extraction for the technician app: when it's online, it
    sends its own locally-tracked transcript here instead of running
    on-device, so the request lands on this node's (larger) model instead
    of the phone's. No session/save side effects -- the app owns its own
    session state, review checkpoint, and eventual /sync entirely; this
    endpoint only ever returns the extracted JSON."""

    transcript: list[str]


class ExtractedEquipmentItem(BaseModel):
    modality: str
    quantity: int | None = None
    brand: str | None = None
    model: str | None = None
    approx_age_years: float | None = None
    confidence: str
    status: str


class ExtractionResultSchema(BaseModel):
    customer: str | None = None
    city: str | None = None
    country: str | None = None
    equipment: list[ExtractedEquipmentItem] = []
    missing_required: list[str] = []
    follow_up_question: str | None = None
    ready_to_save: bool = False

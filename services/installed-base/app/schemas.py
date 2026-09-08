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

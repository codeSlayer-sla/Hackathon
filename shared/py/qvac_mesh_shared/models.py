from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from .enums import (
    ComplexityLevel,
    ConfidenceLevel,
    ExecutionMode,
    ModelTier,
    NodeRole,
    ObservationStatus,
    SensitivityClass,
    SettlementStatus,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# RAG (Workstream 1) <-> Router (Workstream 2)
# ---------------------------------------------------------------------------


class SourceRef(BaseModel):
    doc_id: str
    title: str
    snippet: str


class RagSearchRequest(BaseModel):
    query: str
    filters: dict[str, str] = Field(default_factory=dict)
    top_k: int = 3


class RagResult(BaseModel):
    context: str
    sources: list[SourceRef] = Field(default_factory=list)
    sensitivity: SensitivityClass = SensitivityClass.INTERNAL


# ---------------------------------------------------------------------------
# Router (Workstream 2) <-> Peer (Workstream 3 / 4)
# ---------------------------------------------------------------------------


class PeerCapability(BaseModel):
    node_id: str
    role: NodeRole
    model_tier: ModelTier
    model_name: str
    base_url: str
    available: bool = True
    price_per_1k_tokens: float = 0.0
    last_seen: datetime = Field(default_factory=_utcnow)
    # "completion" | "multimodal" | "transcription" -- what kind of QVAC
    # model this peer has loaded. Defaults to completion-only so existing
    # peer-medium/peer-gpu configs don't need to change.
    capabilities: list[str] = Field(default_factory=lambda: ["completion"])


class ExecutionPlan(BaseModel):
    complexity: ComplexityLevel
    model_tier: ModelTier
    target_node_id: str
    execution_mode: ExecutionMode
    reason: str
    estimated_cost: float = 0.0


class InferenceRequest(BaseModel):
    request_id: str
    query: str
    context: str | None = None
    # Set only for a "multimodal" peer: path to an image file the peer's
    # own filesystem can read (see the media-data volume shared between
    # installed-base and peer-vision).
    image_path: str | None = None


class InferenceResult(BaseModel):
    request_id: str
    node_id: str
    model: str
    answer: str
    duration_ms: float
    tokens_in: int
    tokens_out: int
    cost: float


class TranscribeRequest(BaseModel):
    request_id: str
    audio_path: str


class TranscribeResult(BaseModel):
    request_id: str
    node_id: str
    model: str
    text: str
    duration_ms: float


class RouterInferRequest(BaseModel):
    """The one entry point any service uses for *any* inference need --
    the Router decides which peer (by capability) handles it, so domain
    services never discover/call a Peer directly."""

    request_id: str | None = None
    capability: str  # "completion" | "multimodal" | "transcription"
    query: str | None = None
    context: str | None = None
    image_path: str | None = None
    audio_path: str | None = None


class RouterInferResult(BaseModel):
    request_id: str
    node_id: str
    model: str
    capability: str
    text: str
    duration_ms: float


# ---------------------------------------------------------------------------
# Usage / economy (Workstream 5)
# ---------------------------------------------------------------------------


class UsageEvent(BaseModel):
    request_id: str
    node_id: str
    model: str
    duration_ms: float
    tokens_in: int
    tokens_out: int
    cost: float
    settlement_status: SettlementStatus = SettlementStatus.NOT_IMPLEMENTED
    timestamp: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------------------
# End-to-end flow exposed by the Router to the Frontend
# ---------------------------------------------------------------------------


class AskRequest(BaseModel):
    query: str
    sensitivity_hint: SensitivityClass | None = None


class AskResponse(BaseModel):
    answer: str
    rag: RagResult
    plan: ExecutionPlan
    usage: UsageEvent


# ---------------------------------------------------------------------------
# Customer Installed Base Intelligence (Philips hackathon challenge)
# ---------------------------------------------------------------------------


class EquipmentObservation(BaseModel):
    id: int | None = None
    customer: str
    city: str | None = None
    country: str | None = None
    modality: str
    quantity: int | None = None
    brand: str | None = None
    model: str | None = None
    approx_age_years: float | None = None
    estimated_install_year: int | None = None
    confidence: ConfidenceLevel = ConfidenceLevel.LOW
    status: ObservationStatus = ObservationStatus.UNKNOWN
    source: str = "text"
    observer: str | None = None
    visit_date: str | None = None
    notes: str | None = None
    possible_duplicate_of: list[int] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)


class CaptureTurnRequest(BaseModel):
    session_id: str | None = None
    text: str
    # Client-generated id (e.g. a UUID the mobile app creates when it first
    # queues this turn locally). Lets a retried offline-sync submission be
    # detected and answered from cache instead of saving the observation
    # twice.
    client_event_id: str | None = None


class CaptureTurnResponse(BaseModel):
    session_id: str
    agent_message: str
    saved_observations: list[EquipmentObservation] = Field(default_factory=list)
    done: bool = False


class CustomerSummary(BaseModel):
    customer: str
    country: str | None = None
    city: str | None = None
    equipment_count: int
    modalities: dict[str, int] = Field(default_factory=dict)
    last_updated: datetime | None = None
    has_incomplete_info: bool = False


class RefreshOpportunity(BaseModel):
    customer: str
    reason: str


class AnalyticsSummary(BaseModel):
    total_observations: int
    by_modality: dict[str, int] = Field(default_factory=dict)
    by_country: dict[str, int] = Field(default_factory=dict)
    by_status: dict[str, int] = Field(default_factory=dict)
    average_age_years: float | None = None
    aging_customers: list[str] = Field(default_factory=list)
    incomplete_customers: list[str] = Field(default_factory=list)
    stale_customers: list[str] = Field(default_factory=list)
    refresh_opportunities: list[RefreshOpportunity] = Field(default_factory=list)


class NaturalLanguageQueryRequest(BaseModel):
    question: str


class NaturalLanguageQueryResponse(BaseModel):
    question: str
    interpreted_filter: dict
    results: list[EquipmentObservation]

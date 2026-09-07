from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from .enums import (
    ComplexityLevel,
    ExecutionMode,
    ModelTier,
    NodeRole,
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


class InferenceResult(BaseModel):
    request_id: str
    node_id: str
    model: str
    answer: str
    duration_ms: float
    tokens_in: int
    tokens_out: int
    cost: float


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

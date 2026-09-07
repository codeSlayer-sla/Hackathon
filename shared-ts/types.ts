// Mirrors shared/py/qvac_mesh_shared/{enums,models}.py.
// Keep both in sync by hand for the hackathon; if this drifts, the Pydantic
// side is the source of truth (FastAPI's /openapi.json can regenerate this
// later if we want it typed automatically).

export type SensitivityClass = "public" | "internal" | "confidential" | "restricted";
export type ComplexityLevel = "low" | "medium" | "high";
export type ModelTier = "small" | "medium" | "large";
export type NodeRole = "enterprise" | "medium_provider" | "large_provider";
export type ExecutionMode = "local" | "p2p";
export type SettlementStatus = "not_implemented" | "pending" | "settled";

export interface SourceRef {
  doc_id: string;
  title: string;
  snippet: string;
}

export interface RagResult {
  context: string;
  sources: SourceRef[];
  sensitivity: SensitivityClass;
}

export interface PeerCapability {
  node_id: string;
  role: NodeRole;
  model_tier: ModelTier;
  model_name: string;
  base_url: string;
  available: boolean;
  price_per_1k_tokens: number;
  last_seen: string;
}

export interface ExecutionPlan {
  complexity: ComplexityLevel;
  model_tier: ModelTier;
  target_node_id: string;
  execution_mode: ExecutionMode;
  reason: string;
  estimated_cost: number;
}

export interface UsageEvent {
  request_id: string;
  node_id: string;
  model: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  settlement_status: SettlementStatus;
  timestamp: string;
}

export interface AskRequest {
  query: string;
  sensitivity_hint?: SensitivityClass;
}

export interface AskResponse {
  answer: string;
  rag: RagResult;
  plan: ExecutionPlan;
  usage: UsageEvent;
}

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

// --- Customer Installed Base Intelligence (Philips hackathon challenge) ---

export type ObservationStatus = "confirmed" | "reported" | "estimated" | "unknown";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface EquipmentObservation {
  id: number | null;
  customer: string;
  city?: string;
  country?: string;
  modality: string;
  quantity?: number;
  brand?: string;
  model?: string;
  approx_age_years?: number;
  estimated_install_year?: number;
  confidence: ConfidenceLevel;
  status: ObservationStatus;
  source: string;
  observer?: string;
  visit_date?: string;
  notes?: string;
  possible_duplicate_of: number[];
  created_at: string;
}

export interface CaptureTurnRequest {
  session_id?: string;
  text: string;
  client_event_id?: string;
}

export interface CaptureTurnResponse {
  session_id: string;
  agent_message: string;
  saved_observations: EquipmentObservation[];
  done: boolean;
}

export interface CustomerSummary {
  customer: string;
  country?: string;
  city?: string;
  equipment_count: number;
  modalities: Record<string, number>;
  last_updated?: string;
  has_incomplete_info: boolean;
}

export interface RefreshOpportunity {
  customer: string;
  reason: string;
}

export interface AnalyticsSummary {
  total_observations: number;
  by_modality: Record<string, number>;
  by_country: Record<string, number>;
  by_status: Record<string, number>;
  average_age_years?: number;
  aging_customers: string[];
  incomplete_customers: string[];
  stale_customers: string[];
  refresh_opportunities: RefreshOpportunity[];
}

// Local to the installed-base service (not a cross-service contract, but
// mirrored here for the web demo's login gate).
export interface TechnicianAuthResponse {
  token: string;
  technician_id: string;
  name: string;
}

export interface RegisterTechnicianRequest {
  name: string;
  pin: string;
}

export interface RegisterTechnicianResponse {
  technician_id: string;
  name: string;
}

export interface TechnicianSummary {
  technician_id: string;
  name: string;
  created_at: string;
  last_seen_at?: string;
}

export interface PhotoRecord {
  id: number;
  photo_path: string;
  customer?: string;
  technician_id?: string;
  status: string; // pending | needs_review | confirmed | rejected | failed
  guessed_modality?: string;
  guessed_brand?: string;
  guessed_model?: string;
  guessed_confidence?: string;
  corrected_label?: string;
  linked_observation_id?: number;
  created_at: string;
  processed_at?: string;
}

export interface PhotoCorrection {
  modality: string;
  brand?: string;
  model?: string;
}

export interface PhotoValidateRequest {
  confirmed: boolean;
  correction?: PhotoCorrection;
  client_event_id?: string;
}

export interface NaturalLanguageQueryResponse {
  question: string;
  interpreted_filter: Record<string, unknown>;
  results: EquipmentObservation[];
}

"""Deterministic placeholder routing policy.

Intentionally simple (keyword/length heuristics, no ML classifier): the real
classification rules are mission-dependent and will replace this once tasks
are assigned. What must NOT change later is the shape of the decision
(`ExecutionPlan`) and the fact that RESTRICTED requests never leave the
local/medium tier.
"""

from __future__ import annotations

from qvac_mesh_shared import ComplexityLevel, ExecutionMode, ExecutionPlan, ModelTier, NodeRole, SensitivityClass
from qvac_mesh_shared import PeerCapability

from .peer_registry import registry

HIGH_COMPLEXITY_KEYWORDS = (
    "analiza",
    "analizar",
    "patrones",
    "causa raiz",
    "causa raíz",
    "incidentes",
    "resume todo",
)


def classify_complexity(query: str) -> ComplexityLevel:
    words = query.split()
    lowered = query.lower()
    if len(words) > 40 or any(k in lowered for k in HIGH_COMPLEXITY_KEYWORDS):
        return ComplexityLevel.HIGH
    if len(words) > 12:
        return ComplexityLevel.MEDIUM
    return ComplexityLevel.LOW


def _pick_peer(candidates: list[PeerCapability]) -> PeerCapability | None:
    return candidates[0] if candidates else None


def decide_plan(query: str, sensitivity: SensitivityClass) -> ExecutionPlan:
    complexity = classify_complexity(query)

    if sensitivity == SensitivityClass.RESTRICTED:
        # Architecture rule: RESTRICTED never leaves the local/medium tier,
        # no matter how complex the request looks.
        peer = _pick_peer(registry.available(ModelTier.SMALL)) or _pick_peer(
            registry.available(ModelTier.MEDIUM)
        )
        reason = "sensitivity=restricted -> forced local-only (small/medium tier)"
        mode = ExecutionMode.LOCAL
    elif complexity == ComplexityLevel.HIGH:
        peer = _pick_peer(registry.available(ModelTier.LARGE)) or _pick_peer(
            registry.available(ModelTier.MEDIUM)
        )
        reason = "complexity=high -> prefer large/GPU peer"
        mode = ExecutionMode.P2P if peer and peer.role == NodeRole.LARGE_PROVIDER else ExecutionMode.LOCAL
    else:
        peer = _pick_peer(registry.available(ModelTier.SMALL)) or _pick_peer(
            registry.available(ModelTier.MEDIUM)
        )
        reason = f"complexity={complexity.value} -> smallest available tier is enough"
        mode = ExecutionMode.LOCAL

    if peer is None:
        # Last resort: whatever is available, so the demo degrades instead of failing outright.
        peer = _pick_peer(registry.available())
        reason += "; no tier match, falling back to any available peer"

    if peer is None:
        raise RuntimeError("No peers registered yet - start at least one peer service")

    estimated_cost = peer.price_per_1k_tokens
    return ExecutionPlan(
        complexity=complexity,
        model_tier=peer.model_tier,
        target_node_id=peer.node_id,
        execution_mode=mode,
        reason=reason,
        estimated_cost=estimated_cost,
    )


def pick_by_capability(capability: str) -> PeerCapability:
    """Used by /infer: picks any available peer that has the requested
    capability (completion | multimodal | transcription), ignoring tier --
    tiering only matters for the text-completion routing above."""
    candidates = registry.by_capability(capability)
    if not candidates:
        raise RuntimeError(f"No peer with capability '{capability}' is registered/available")
    return candidates[0]

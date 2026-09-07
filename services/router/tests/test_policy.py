import pytest
from qvac_mesh_shared import ComplexityLevel, ExecutionMode, ModelTier, NodeRole, PeerCapability, SensitivityClass

from app import policy
from app.peer_registry import registry


@pytest.fixture(autouse=True)
def clean_registry():
    registry._peers.clear()
    yield
    registry._peers.clear()


def _cap(node_id: str, role: NodeRole, tier: ModelTier, price: float = 0.0) -> PeerCapability:
    return PeerCapability(
        node_id=node_id,
        role=role,
        model_tier=tier,
        model_name="LLAMA_3_2_1B_INST_Q4_0",
        base_url=f"http://{node_id}:8000",
        price_per_1k_tokens=price,
    )


def test_classify_complexity_short_query_is_low():
    assert policy.classify_complexity("hola") == ComplexityLevel.LOW


def test_classify_complexity_keyword_triggers_high():
    query = "analiza los ultimos 300 incidentes y determina patrones de causa raiz"
    assert policy.classify_complexity(query) == ComplexityLevel.HIGH


def test_decide_plan_picks_available_tier_for_low_complexity():
    registry.upsert(_cap("peer-medium", NodeRole.MEDIUM_PROVIDER, ModelTier.MEDIUM))
    plan = policy.decide_plan("hola", SensitivityClass.INTERNAL)
    assert plan.target_node_id == "peer-medium"
    assert plan.execution_mode == ExecutionMode.LOCAL


def test_decide_plan_prefers_large_tier_for_high_complexity():
    registry.upsert(_cap("peer-medium", NodeRole.MEDIUM_PROVIDER, ModelTier.MEDIUM))
    registry.upsert(_cap("peer-gpu", NodeRole.LARGE_PROVIDER, ModelTier.LARGE, price=0.003))
    plan = policy.decide_plan("analiza 300 incidentes y determina causa raiz", SensitivityClass.INTERNAL)
    assert plan.target_node_id == "peer-gpu"
    assert plan.execution_mode == ExecutionMode.P2P


def test_decide_plan_forces_local_for_restricted_even_if_complex():
    registry.upsert(_cap("peer-medium", NodeRole.MEDIUM_PROVIDER, ModelTier.MEDIUM))
    registry.upsert(_cap("peer-gpu", NodeRole.LARGE_PROVIDER, ModelTier.LARGE, price=0.003))
    plan = policy.decide_plan("analiza 300 incidentes causa raiz", SensitivityClass.RESTRICTED)
    assert plan.target_node_id == "peer-medium"
    assert plan.execution_mode == ExecutionMode.LOCAL


def test_decide_plan_raises_when_no_peers_registered():
    with pytest.raises(RuntimeError):
        policy.decide_plan("hola", SensitivityClass.INTERNAL)

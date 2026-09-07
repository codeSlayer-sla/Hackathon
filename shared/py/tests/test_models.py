from qvac_mesh_shared import (
    AskRequest,
    ComplexityLevel,
    ExecutionMode,
    ExecutionPlan,
    ModelTier,
    NodeRole,
    PeerCapability,
    RagResult,
    SensitivityClass,
    SettlementStatus,
    SourceRef,
    UsageEvent,
)


def test_rag_result_defaults_to_internal_sensitivity():
    result = RagResult(context="ctx")
    assert result.sensitivity == SensitivityClass.INTERNAL
    assert result.sources == []


def test_source_ref_roundtrip():
    ref = SourceRef(doc_id="d1", title="t", snippet="s")
    assert SourceRef.model_validate(ref.model_dump()) == ref


def test_peer_capability_defaults():
    cap = PeerCapability(
        node_id="peer-medium",
        role=NodeRole.MEDIUM_PROVIDER,
        model_tier=ModelTier.MEDIUM,
        model_name="LLAMA_3_2_1B_INST_Q4_0",
        base_url="http://peer-medium:8000",
    )
    assert cap.available is True
    assert cap.price_per_1k_tokens == 0.0
    assert cap.last_seen.tzinfo is not None


def test_execution_plan_defaults_estimated_cost_to_zero():
    plan = ExecutionPlan(
        complexity=ComplexityLevel.HIGH,
        model_tier=ModelTier.LARGE,
        target_node_id="peer-gpu",
        execution_mode=ExecutionMode.P2P,
        reason="test",
    )
    assert plan.estimated_cost == 0.0


def test_usage_event_defaults_settlement_not_implemented():
    usage = UsageEvent(
        request_id="r1",
        node_id="peer-medium",
        model="m",
        duration_ms=1.0,
        tokens_in=1,
        tokens_out=1,
        cost=0.0,
    )
    assert usage.settlement_status == SettlementStatus.NOT_IMPLEMENTED


def test_ask_request_sensitivity_hint_is_optional():
    req = AskRequest(query="hola")
    assert req.sensitivity_hint is None

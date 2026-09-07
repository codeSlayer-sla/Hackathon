import logging
import uuid

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from qvac_mesh_shared import (
    AskRequest,
    AskResponse,
    ExecutionPlan,
    InferenceRequest,
    PeerCapability,
    RagResult,
    RagSearchRequest,
    SensitivityClass,
    SettlementStatus,
    UsageEvent,
)
from qvac_mesh_shared.config import NodeSettings

from . import policy
from .peer_registry import registry

logger = logging.getLogger("router.main")

settings = NodeSettings()

app = FastAPI(title="Enterprise AI Mesh - Router")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "known_peers": len(registry.all())}


@app.post("/peers/register", response_model=PeerCapability)
@app.post("/peers/heartbeat", response_model=PeerCapability)
async def register_peer(capability: PeerCapability) -> PeerCapability:
    registry.upsert(capability)
    return capability


@app.get("/peers")
async def list_peers() -> list[PeerCapability]:
    return registry.all()


@app.post("/route", response_model=ExecutionPlan)
async def route(request: AskRequest) -> ExecutionPlan:
    sensitivity = request.sensitivity_hint or SensitivityClass.INTERNAL
    try:
        return policy.decide_plan(request.query, sensitivity)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


async def _fetch_rag_context(query: str) -> RagResult:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.rag_url}/search", json=RagSearchRequest(query=query).model_dump()
        )
        resp.raise_for_status()
        return RagResult.model_validate(resp.json())


@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest) -> AskResponse:
    request_id = str(uuid.uuid4())

    rag_result = await _fetch_rag_context(request.query)
    sensitivity = request.sensitivity_hint or rag_result.sensitivity
    plan = policy.decide_plan(request.query, sensitivity)

    target = next((p for p in registry.all() if p.node_id == plan.target_node_id), None)
    if target is None:
        raise HTTPException(status_code=503, detail=f"Peer {plan.target_node_id} is not registered")

    async with httpx.AsyncClient(timeout=120.0) as client:
        infer_resp = await client.post(
            f"{target.base_url}/infer",
            json=InferenceRequest(
                request_id=request_id, query=request.query, context=rag_result.context
            ).model_dump(),
        )
        infer_resp.raise_for_status()
        result = infer_resp.json()

    usage = UsageEvent(
        request_id=request_id,
        node_id=result["node_id"],
        model=result["model"],
        duration_ms=result["duration_ms"],
        tokens_in=result["tokens_in"],
        tokens_out=result["tokens_out"],
        cost=result["cost"],
        settlement_status=SettlementStatus.NOT_IMPLEMENTED,
    )

    return AskResponse(answer=result["answer"], rag=rag_result, plan=plan, usage=usage)

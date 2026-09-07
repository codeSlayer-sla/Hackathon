import asyncio
import logging
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from qvac_mesh_shared import InferenceRequest, InferenceResult, NodeRole, ModelTier, PeerCapability
from qvac_mesh_shared.config import NodeSettings

from .qvac_runtime import QvacRuntime

logger = logging.getLogger("peer.main")

settings = NodeSettings()
runtime = QvacRuntime(model_name=settings.model_name)

HEARTBEAT_INTERVAL_SECONDS = 20


def _capability() -> PeerCapability:
    return PeerCapability(
        node_id=settings.node_id,
        role=NodeRole(settings.role),
        model_tier=ModelTier(settings.model_tier),
        model_name=settings.model_name,
        base_url=f"http://{settings.node_id}:{settings.port}",
        available=runtime.ready,
        price_per_1k_tokens=settings.price_per_1k_tokens,
    )


async def _register_loop() -> None:
    async with httpx.AsyncClient(timeout=5.0) as client:
        while True:
            try:
                await client.post(
                    f"{settings.router_url}/peers/heartbeat",
                    json=_capability().model_dump(mode="json"),
                )
            except Exception:
                logger.warning("Could not reach Router at %s to heartbeat", settings.router_url)
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await runtime.startup()
    heartbeat_task = asyncio.create_task(_register_loop())
    yield
    heartbeat_task.cancel()
    await runtime.shutdown()


app = FastAPI(title=f"Enterprise AI Mesh - Peer ({settings.role})", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "node_id": settings.node_id, "qvac_ready": runtime.ready}


@app.get("/capabilities", response_model=PeerCapability)
async def capabilities() -> PeerCapability:
    return _capability()


@app.post("/infer", response_model=InferenceResult)
async def infer(request: InferenceRequest) -> InferenceResult:
    answer, tokens_in, tokens_out, duration_ms = await runtime.complete(request.query, request.context)
    cost = (tokens_in + tokens_out) / 1000 * settings.price_per_1k_tokens
    return InferenceResult(
        request_id=request.request_id or str(uuid.uuid4()),
        node_id=settings.node_id,
        model=settings.model_name,
        answer=answer,
        duration_ms=duration_ms,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost=cost,
    )

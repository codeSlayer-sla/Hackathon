from contextlib import asynccontextmanager

from fastapi import FastAPI
from qvac_mesh_shared import RagResult, RagSearchRequest

from .rag_engine import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    await engine.startup()
    yield
    await engine.shutdown()


app = FastAPI(title="Enterprise AI Mesh - RAG service", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "qvac_ready": engine.ready}


@app.post("/search", response_model=RagResult)
async def search(request: RagSearchRequest) -> RagResult:
    return await engine.search(request.query, request.top_k)

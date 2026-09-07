"""RAG engine: real QVAC-backed retrieval when the SDK/model are available,
with a keyword-search fallback so the service is demoable even without a
model download (offline dev, CI, first `docker compose up`).

The RAG surface in `tetherto-qvac-sdk==0.19.x` is a single `rag(transport,
params)` call, where `params` is a discriminated union built via
`RagRequest.model_validate({...})` with an `operation` field ("ingest",
"search", ...) -- NOT the separate `ragIngest`/`ragSearch` per-operation
functions the JS docs show. Verified by installing the package and
inspecting `tetherto.qvac_sdk.rag` / `RagRequest.model_fields` directly,
since the Python RAG example isn't published in the docs yet.
"""

from __future__ import annotations

import logging
import re

from qvac_mesh_shared import SensitivityClass, SourceRef, RagResult

from .demo_docs import DEMO_DOCUMENTS

logger = logging.getLogger("rag.engine")

WORKSPACE = "enterprise-demo"
EMBEDDING_MODEL_NAME = "EMBEDDINGGEMMA_300M_Q4_0"


class RagEngine:
    """Owns the QVAC embedding model + workspace lifecycle for one process."""

    def __init__(self) -> None:
        self._qvac_ready = False
        self._client = None
        self._transport = None
        self._embed_model_id: str | None = None

    @property
    def ready(self) -> bool:
        return self._qvac_ready

    async def startup(self) -> None:
        try:
            await self._init_qvac()
            await self._ingest_demo_docs()
            self._qvac_ready = True
            logger.info("RAG engine ready with real QVAC embeddings + workspace search")
        except Exception:  # pragma: no cover - defensive fallback path
            logger.warning(
                "QVAC RAG backend unavailable (SDK not installed, worker missing, or "
                "no model downloaded yet) -- falling back to keyword search over the "
                "bundled demo docs. Real retrieval will kick in automatically once "
                "the SDK/model are ready.",
                exc_info=True,
            )
            self._qvac_ready = False

    async def shutdown(self) -> None:
        if not self._qvac_ready or self._client is None:
            return
        try:
            from tetherto.qvac_sdk import RagRequest, rag, unload_model

            await rag(
                self._transport,
                RagRequest.model_validate(
                    {"type": "rag", "operation": "closeWorkspace", "workspace": WORKSPACE}
                ),
            )
            if self._embed_model_id:
                await unload_model(self._transport, self._embed_model_id)
        except Exception:
            logger.warning("Error shutting down QVAC RAG backend", exc_info=True)
        finally:
            await self._client.__aexit__(None, None, None)

    async def _init_qvac(self) -> None:
        from tetherto.qvac_sdk import Client, load_model
        from tetherto.qvac_sdk.models import EMBEDDINGGEMMA_300M_Q4_0

        self._client = Client()
        await self._client.__aenter__()
        self._transport = self._client.transport
        self._embed_model_id = await load_model(
            self._transport, model_src=EMBEDDINGGEMMA_300M_Q4_0
        )

    async def _ingest_demo_docs(self) -> None:
        from tetherto.qvac_sdk import RagRequest, rag

        response = await rag(
            self._transport,
            RagRequest.model_validate(
                {
                    "type": "rag",
                    "operation": "ingest",
                    "model_id": self._embed_model_id,
                    "workspace": WORKSPACE,
                    "documents": [doc["text"] for doc in DEMO_DOCUMENTS],
                    "chunk": False,
                }
            ),
        )
        if not response.root.success:
            raise RuntimeError(f"RAG ingest failed: {response.root.error}")

    async def search(self, query: str, top_k: int = 3) -> RagResult:
        if self._qvac_ready:
            try:
                return await self._search_qvac(query, top_k)
            except Exception:
                logger.warning("QVAC RAG search failed, falling back to keyword search", exc_info=True)
        return self._search_fallback(query, top_k)

    async def _search_qvac(self, query: str, top_k: int) -> RagResult:
        from tetherto.qvac_sdk import RagRequest, rag

        response = await rag(
            self._transport,
            RagRequest.model_validate(
                {
                    "type": "rag",
                    "operation": "search",
                    "model_id": self._embed_model_id,
                    "workspace": WORKSPACE,
                    "query": query,
                    "top_k": top_k,
                }
            ),
        )
        if not response.root.success:
            raise RuntimeError(f"RAG search failed: {response.root.error}")

        by_snippet = {doc["text"]: doc for doc in DEMO_DOCUMENTS}
        sources = []
        for i, r in enumerate(response.root.results):
            doc = by_snippet.get(r.content)
            sources.append(
                SourceRef(
                    doc_id=doc["doc_id"] if doc else r.id,
                    title=doc["title"] if doc else f"chunk-{i}",
                    snippet=r.content[:280],
                )
            )
        context = "\n\n".join(s.snippet for s in sources)
        return RagResult(context=context, sources=sources, sensitivity=SensitivityClass.INTERNAL)

    def _search_fallback(self, query: str, top_k: int) -> RagResult:
        terms = [t for t in re.findall(r"\w+", query.lower()) if len(t) > 2]

        def score(doc: dict[str, str]) -> int:
            text = doc["text"].lower()
            return sum(text.count(t) for t in terms)

        ranked = sorted(DEMO_DOCUMENTS, key=score, reverse=True)
        top = [d for d in ranked if score(d) > 0][:top_k] or DEMO_DOCUMENTS[:top_k]

        sources = [
            SourceRef(doc_id=d["doc_id"], title=d["title"], snippet=d["text"][:280]) for d in top
        ]
        context = "\n\n".join(s.snippet for s in sources)
        return RagResult(context=context, sources=sources, sensitivity=SensitivityClass.INTERNAL)


engine = RagEngine()

"""Wraps one QVAC completion model behind a tiny async facade.

Same image is used for the Medium and the GPU/Large peer -- the only
difference between the two is configuration (MODEL_NAME, MODEL_TIER,
PRICE_PER_1K_TOKENS env vars), never code. This is the piece that makes a
peer's `/infer` return a genuine local LLM answer instead of a mock.
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger("peer.qvac_runtime")


class QvacRuntime:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self.ready = False
        self._client = None
        self._transport = None
        self._model_id: str | None = None

    async def startup(self) -> None:
        try:
            from tetherto.qvac_sdk import Client, load_model
            from tetherto.qvac_sdk import models as qvac_models

            model_src = getattr(qvac_models, self.model_name)
            self._client = Client()
            await self._client.__aenter__()
            self._transport = self._client.transport
            self._model_id = await load_model(self._transport, model_src=model_src)
            self.ready = True
            logger.info("QVAC model '%s' loaded, peer ready for real inference", self.model_name)
        except Exception:
            logger.warning(
                "Could not load QVAC model '%s' (SDK missing, worker missing, or model not "
                "downloaded yet) -- /infer will return a stub answer until this is fixed.",
                self.model_name,
                exc_info=True,
            )
            self.ready = False

    async def shutdown(self) -> None:
        if not self.ready or self._client is None:
            return
        try:
            from tetherto.qvac_sdk import unload_model

            if self._model_id:
                await unload_model(self._transport, self._model_id)
        except Exception:
            logger.warning("Error unloading QVAC model", exc_info=True)
        finally:
            await self._client.__aexit__(None, None, None)

    async def complete(self, query: str, context: str | None) -> tuple[str, int, int, float]:
        """Returns (answer, tokens_in, tokens_out, duration_ms)."""
        started = time.perf_counter()

        if not self.ready:
            answer = (
                f"[stub - {self.model_name} not loaded] No puedo ejecutar inferencia real "
                f"todavia en este peer. Pregunta recibida: {query!r}"
            )
            duration_ms = (time.perf_counter() - started) * 1000
            return answer, len(query.split()), len(answer.split()), duration_ms

        from tetherto.qvac_sdk import completion

        prompt = query if not context else f"Contexto:\n{context}\n\nPregunta: {query}"
        run = completion(
            self._transport,
            model_id=self._model_id,
            history=[{"role": "user", "content": prompt}],
        )
        answer = await run.text()

        duration_ms = (time.perf_counter() - started) * 1000
        tokens_in, tokens_out = len(prompt.split()), len(answer.split())
        try:
            # `.stats` is untyped on the SDK side; use real counts if the
            # backend happens to expose them, otherwise keep the word-count
            # approximation (the hackathon doc itself calls these "tokens
            # aproximados", so this is an accepted MVP shortcut).
            stats = await run.stats()
            if isinstance(stats, dict):
                tokens_in = stats.get("prompt_tokens", stats.get("tokens_in", tokens_in))
                tokens_out = stats.get("completion_tokens", stats.get("tokens_out", tokens_out))
        except Exception:
            logger.debug("No usable token stats from CompletionRun.stats()", exc_info=True)

        return answer, tokens_in, tokens_out, duration_ms

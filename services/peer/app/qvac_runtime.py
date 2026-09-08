"""Wraps one QVAC model behind a tiny async facade.

Same image is used for every peer kind (completion, multimodal, transcription)
-- the only difference is configuration (MODEL_KIND, MODEL_NAME,
MODEL_PROJECTION_NAME env vars), never code. This is the piece that makes a
peer's `/infer`/`/transcribe` return a genuine local QVAC result instead of
a mock.
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger("peer.qvac_runtime")

VALID_KINDS = ("completion", "multimodal", "transcription")


class QvacRuntime:
    def __init__(self, model_name: str, kind: str = "completion", projection_model_name: str | None = None) -> None:
        if kind not in VALID_KINDS:
            raise ValueError(f"Unknown model kind {kind!r}, expected one of {VALID_KINDS}")
        self.model_name = model_name
        self.kind = kind
        self.projection_model_name = projection_model_name
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

            if self.kind == "multimodal":
                if not self.projection_model_name:
                    raise ValueError("multimodal peers require MODEL_PROJECTION_NAME")
                projection_src = getattr(qvac_models, self.projection_model_name)
                self._model_id = await load_model(
                    self._transport,
                    model_src=model_src,
                    model_config={"projectionModelSrc": projection_src},
                )
            else:
                self._model_id = await load_model(self._transport, model_src=model_src)

            self.ready = True
            logger.info("QVAC model '%s' (%s) loaded, peer ready for real inference", self.model_name, self.kind)
        except Exception:
            logger.warning(
                "Could not load QVAC model '%s' (SDK missing, worker missing, or model not "
                "downloaded yet) -- this peer will return stub results until fixed.",
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

    async def complete(
        self, query: str, context: str | None, image_path: str | None = None
    ) -> tuple[str, int, int, float]:
        """Returns (answer, tokens_in, tokens_out, duration_ms). Used for both
        `completion` peers (image_path always None) and `multimodal` peers
        (image_path set when the caller attached a photo)."""
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
        message: dict = {"role": "user", "content": prompt}
        if image_path:
            message["attachments"] = [{"path": image_path}]

        run = completion(self._transport, model_id=self._model_id, history=[message])
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

    async def transcribe(self, audio_path: str) -> tuple[str, float]:
        """Returns (text, duration_ms). Only meaningful for `transcription` peers.

        Verified against the installed `tetherto-qvac-sdk==0.19.x`:
        `transcribe(transport, TranscribeRequest) -> AsyncIterator[TranscribeResponse]`
        (a streaming call, unlike JS's batch `transcribe()` -- the Python
        SDK only exposes the streaming shape). Each event may carry a
        `text` delta and a `done` flag; we accumulate deltas and, if the
        final event's own `text` is longer (some engines emit the full
        transcript on the last event instead of a delta), prefer that.
        """
        started = time.perf_counter()

        if not self.ready:
            duration_ms = (time.perf_counter() - started) * 1000
            return f"[stub - {self.model_name} not loaded] audio at {audio_path!r} not transcribed", duration_ms

        from tetherto.qvac_sdk import TranscribeRequest, transcribe as qvac_transcribe

        request = TranscribeRequest.model_validate(
            {
                "model_id": self._model_id,
                "audio_chunk": {"type": "filePath", "value": audio_path},
            }
        )

        accumulated = ""
        final_text: str | None = None
        async for event in qvac_transcribe(self._transport, request):
            if event.text:
                accumulated += event.text
                if event.done:
                    final_text = event.text

        text = final_text if final_text and len(final_text) > len(accumulated) else accumulated
        duration_ms = (time.perf_counter() - started) * 1000
        return text, duration_ms

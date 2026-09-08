"""In-memory per-session capture conversation state.

Same "process-local dict, no external store" pattern as
services/router/app/peer_registry.py -- state is lost on restart, which is
fine for a single field-visit capture conversation in this MVP.
"""

from __future__ import annotations

import uuid


class CaptureSession:
    def __init__(self) -> None:
        self.transcript: list[str] = []


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, CaptureSession] = {}

    def get_or_create(self, session_id: str | None) -> tuple[str, CaptureSession]:
        if session_id and session_id in self._sessions:
            return session_id, self._sessions[session_id]
        new_id = session_id or str(uuid.uuid4())
        session = self._sessions.setdefault(new_id, CaptureSession())
        return new_id, session

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


sessions = SessionStore()

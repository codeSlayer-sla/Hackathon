"""Minimal technician PIN authentication.

Intentionally the smallest thing that works for a hackathon demo, and
documented as such: PINs are hashed with sha256+pepper (not bcrypt/argon2),
there's no rate-limiting or lockout, and tokens are plain random strings
held in memory (lost on restart). Good enough to attribute an observation
to a real person on the team and stop an unauthenticated client from
posting as anyone; NOT good enough for a real production rollout -- see
the README's "Auth" limitations section for what to harden before that.
"""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException

AUTH_PEPPER = os.environ.get("AUTH_PEPPER", "hackathon-demo-pepper-change-me")
TOKEN_TTL_HOURS = 12

# Demo technician roster (fictional, same "hackathon dummy data" spirit as
# the seeded observations) -- name -> PIN. In a real deployment this would
# be a technicians table an admin manages, not a hardcoded dict.
_DEMO_TECHNICIANS = {
    "tech-01": {"name": "Field User 01", "pin": "1234"},
    "tech-02": {"name": "Sales User 02", "pin": "2345"},
    "tech-03": {"name": "Field User 03", "pin": "3456"},
}


def _hash_pin(pin: str) -> str:
    return hashlib.sha256(f"{pin}{AUTH_PEPPER}".encode()).hexdigest()


_PIN_INDEX = {_hash_pin(t["pin"]): (tech_id, t["name"]) for tech_id, t in _DEMO_TECHNICIANS.items()}


class TokenStore:
    def __init__(self) -> None:
        self._tokens: dict[str, tuple[str, str, datetime]] = {}  # token -> (technician_id, name, expires_at)

    def issue(self, technician_id: str, name: str) -> str:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
        self._tokens[token] = (technician_id, name, expires_at)
        return token

    def resolve(self, token: str) -> tuple[str, str] | None:
        entry = self._tokens.get(token)
        if entry is None:
            return None
        technician_id, name, expires_at = entry
        if datetime.now(timezone.utc) > expires_at:
            del self._tokens[token]
            return None
        return technician_id, name


tokens = TokenStore()


def authenticate_pin(pin: str) -> tuple[str, str] | None:
    return _PIN_INDEX.get(_hash_pin(pin))


async def get_current_technician(authorization: str | None = Header(default=None)) -> tuple[str, str]:
    """FastAPI dependency: requires `Authorization: Bearer <token>`, returns
    (technician_id, name). The caller can never spoof this via a request
    body field -- identity always comes from the token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    resolved = tokens.resolve(token)
    if resolved is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resolved

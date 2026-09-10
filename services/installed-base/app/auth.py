"""Minimal technician PIN authentication.

Intentionally the smallest thing that works for a hackathon demo, and
documented as such: PINs are hashed with sha256+pepper (not bcrypt/argon2),
there's no rate-limiting or lockout, tokens are plain random strings held
in memory (lost on restart, unlike the technician roster itself which is
now in SQLite), and technician registration (below) has no admin auth of
its own -- anyone who can reach this service can register a technician.
Good enough to attribute an observation to a real person on the team and
stop an unauthenticated client from posting as anyone; NOT good enough for
a real production rollout -- see the README's "Auth" limitations section
for what to harden before that.
"""

from __future__ import annotations

import hashlib
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException

from .store import Store

AUTH_PEPPER = os.environ.get("AUTH_PEPPER", "hackathon-demo-pepper-change-me")
TOKEN_TTL_HOURS = 12
PIN_PATTERN = re.compile(r"^\d{4,8}$")

# Seeded into the technicians table on a fresh DB only (see
# Store.seed_technicians_if_empty) so the PINs already documented in the
# README/mobile app keep working without every deployment having to
# register them by hand first. Real registrations go through
# register_technician below, backed by SQLite, not this dict.
_DEMO_SEED = {
    "tech-01": {"name": "Field User 01", "pin": "1234"},
    "tech-02": {"name": "Sales User 02", "pin": "2345"},
    "tech-03": {"name": "Field User 03", "pin": "3456"},
}

_store: Store | None = None


def _hash_pin(pin: str) -> str:
    return hashlib.sha256(f"{pin}{AUTH_PEPPER}".encode()).hexdigest()


def set_store(store: Store) -> None:
    """Called once at startup (main.py's lifespan) -- avoids a circular
    import (store.py doesn't need to know about auth.py) while still
    letting this module reach the same persistent technician table
    main.py's endpoints use for everything else."""
    global _store
    _store = store
    store.seed_technicians_if_empty(
        [(tech_id, t["name"], _hash_pin(t["pin"])) for tech_id, t in _DEMO_SEED.items()]
    )


def _require_store() -> Store:
    if _store is None:
        raise RuntimeError("auth.set_store() was never called -- app not started via its lifespan")
    return _store


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
    resolved = _require_store().find_technician_by_pin_hash(_hash_pin(pin))
    if resolved is None:
        return None
    return resolved["technician_id"], resolved["name"]


def register_technician(name: str, pin: str) -> tuple[str, str]:
    """Registers a new technician (frontend admin view). Raises ValueError
    on bad input or a PIN already in use by someone else -- callers map
    that to a 400/409, this module doesn't know about HTTP."""
    name = name.strip()
    if not name:
        raise ValueError("name is required")
    if not PIN_PATTERN.match(pin):
        raise ValueError("pin must be 4-8 digits")

    store = _require_store()
    pin_hash = _hash_pin(pin)
    if store.find_technician_by_pin_hash(pin_hash) is not None:
        raise ValueError("PIN already in use by another technician")

    technician_id = f"tech-{uuid.uuid4().hex[:8]}"
    store.insert_technician(technician_id, name, pin_hash)
    return technician_id, name


def list_technicians() -> list[dict]:
    """For the frontend's ops dashboard -- id/name/created_at/last_seen_at/
    last_extract_at/observation_count, never a PIN or its hash."""
    return _require_store().list_technicians_with_activity()


def mark_used_remote_extraction(technician_id: str) -> None:
    _require_store().touch_technician_last_extract(technician_id)


def list_roster() -> dict:
    """PIN hashes (never raw PINs) + the pepper, for the mobile app to cache
    and verify logins locally when offline. Gated behind an existing token
    (see get_current_technician below) so it's reachable only by a
    technician who has already authenticated online at least once --
    the pepper is not baked into the app bundle, so it can rotate without
    a rebuild."""
    store = _require_store()
    return {
        "pepper": AUTH_PEPPER,
        "technicians": [
            {"technician_id": t["technician_id"], "name": t["name"], "pin_hash": t["pin_hash"]}
            for t in store.list_technicians_for_roster()
        ],
    }


async def get_current_technician(authorization: str | None = Header(default=None)) -> tuple[str, str]:
    """FastAPI dependency: requires `Authorization: Bearer <token>`, returns
    (technician_id, name). The caller can never spoof this via a request
    body field -- identity always comes from the token. Also bumps the
    technician's last_seen_at on every authenticated call (login, capture,
    sync, extract, roster) -- this is what makes "which technician apps are
    actually talking to us and when" a real, queryable fact instead of a
    guess."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    resolved = tokens.resolve(token)
    if resolved is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    technician_id, _ = resolved
    _require_store().touch_technician_last_seen(technician_id)
    return resolved

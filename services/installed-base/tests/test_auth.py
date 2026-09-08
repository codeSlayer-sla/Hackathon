import pytest
from fastapi import HTTPException

from app import auth


def test_authenticate_pin_valid_returns_technician():
    resolved = auth.authenticate_pin("1234")
    assert resolved is not None
    technician_id, name = resolved
    assert technician_id == "tech-01"
    assert name == "Field User 01"


def test_authenticate_pin_invalid_returns_none():
    assert auth.authenticate_pin("0000") is None


def test_token_issue_and_resolve_roundtrip():
    store = auth.TokenStore()
    token = store.issue("tech-01", "Field User 01")
    resolved = store.resolve(token)
    assert resolved == ("tech-01", "Field User 01")


def test_token_resolve_unknown_token_returns_none():
    store = auth.TokenStore()
    assert store.resolve("not-a-real-token") is None


def test_token_resolve_expired_token_returns_none(monkeypatch):
    import datetime as real_datetime

    store = auth.TokenStore()
    token = store.issue("tech-01", "Field User 01")

    future = real_datetime.datetime.now(real_datetime.timezone.utc) + real_datetime.timedelta(hours=auth.TOKEN_TTL_HOURS + 1)

    class _FrozenDatetime(real_datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            return future

    monkeypatch.setattr(auth, "datetime", _FrozenDatetime)
    assert store.resolve(token) is None


@pytest.mark.anyio
async def test_get_current_technician_rejects_missing_header():
    with pytest.raises(HTTPException) as exc_info:
        await auth.get_current_technician(authorization=None)
    assert exc_info.value.status_code == 401


@pytest.mark.anyio
async def test_get_current_technician_rejects_invalid_token():
    with pytest.raises(HTTPException) as exc_info:
        await auth.get_current_technician(authorization="Bearer not-a-real-token")
    assert exc_info.value.status_code == 401


@pytest.mark.anyio
async def test_get_current_technician_accepts_valid_token():
    token = auth.tokens.issue("tech-02", "Sales User 02")
    technician_id, name = await auth.get_current_technician(authorization=f"Bearer {token}")
    assert technician_id == "tech-02"
    assert name == "Sales User 02"

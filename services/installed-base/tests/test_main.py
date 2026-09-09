import io

from fastapi.testclient import TestClient

from app.main import app

VALID_PIN = "1234"


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400 and self.status_code != 503:
            raise AssertionError(f"unexpected status {self.status_code}")

    def json(self) -> dict:
        return self._payload


class _FakeRouterClient:
    """Stands in for httpx.AsyncClient inside app.extraction: every call
    goes to `{router_url}/infer` now (Router-mediated capability routing),
    branching on the request's `capability` field. Configure per test via
    `_FakeRouterClient.responses = {"completion": "...json...", ...}`.
    """

    responses: dict[str, str] = {}
    calls: list[dict] = []

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self) -> "_FakeRouterClient":
        return self

    async def __aexit__(self, *exc) -> bool:
        return False

    async def post(self, url: str, json: dict | None = None, **kwargs) -> _FakeResponse:
        assert url.endswith("/infer")
        type(self).calls.append(json)
        capability = json["capability"]
        if capability not in type(self).responses:
            return _FakeResponse({"detail": f"No peer with capability '{capability}'"}, status_code=503)
        return _FakeResponse(
            {
                "request_id": json.get("request_id") or "r1",
                "node_id": "peer-x",
                "model": "m",
                "capability": capability,
                "text": type(self).responses[capability],
            }
        )


def _reset_fake_router():
    _FakeRouterClient.responses = {}
    _FakeRouterClient.calls = []


COMPLETE_EXTRACTION = (
    '{"customer": "Hospital Test", "city": null, "country": "Panama", '
    '"equipment": [{"modality": "MR", "quantity": 2, "brand": "NovaMed", '
    '"model": null, "approx_age_years": 7, "confidence": "high", "status": "reported"}], '
    '"missing_required": [], "follow_up_question": null, "ready_to_save": true}'
)
INCOMPLETE_EXTRACTION = (
    '{"customer": null, "equipment": [], "missing_required": ["customer"], '
    '"follow_up_question": "Which hospital?", "ready_to_save": false}'
)


def _login(client: TestClient) -> str:
    resp = client.post("/auth/technician", json={"pin": VALID_PIN})
    assert resp.status_code == 200
    return resp.json()["token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_health():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"


def test_customers_are_seeded_on_startup():
    with TestClient(app) as client:
        customers = client.get("/customers").json()
        assert len(customers) >= 10
        assert any(c["customer"] == "Hospital DemoCare Pacific" for c in customers)


def test_customer_detail_not_found_returns_404():
    with TestClient(app) as client:
        resp = client.get("/customers/does-not-exist")
        assert resp.status_code == 404


def test_customer_detail_returns_its_observations():
    with TestClient(app) as client:
        resp = client.get("/customers/Hospital DemoCare Pacific")
        assert resp.status_code == 200
        assert len(resp.json()) == 2  # MR + CT, per the seed data


def test_analytics_reflects_seed_data():
    with TestClient(app) as client:
        analytics = client.get("/analytics").json()
        assert analytics["total_observations"] >= 20
        assert "MR" in analytics["by_modality"]


# -- auth ------------------------------------------------------------


def test_auth_technician_valid_pin_returns_token():
    with TestClient(app) as client:
        resp = client.post("/auth/technician", json={"pin": VALID_PIN})
        assert resp.status_code == 200
        body = resp.json()
        assert body["token"]
        assert body["name"] == "Field User 01"


def test_auth_technician_invalid_pin_returns_401():
    with TestClient(app) as client:
        resp = client.post("/auth/technician", json={"pin": "0000"})
        assert resp.status_code == 401


def test_auth_roster_requires_auth():
    with TestClient(app) as client:
        resp = client.get("/auth/roster")
        assert resp.status_code == 401


def test_auth_roster_returns_pepper_and_pin_hashes():
    with TestClient(app) as client:
        token = _login(client)
        resp = client.get("/auth/roster", headers=_auth_headers(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["pepper"]
        names = {t["name"] for t in body["technicians"]}
        assert "Field User 01" in names
        # never the raw PIN
        assert all(VALID_PIN not in t["pin_hash"] for t in body["technicians"])


def test_capture_turn_requires_auth():
    with TestClient(app) as client:
        resp = client.post("/capture/turn", json={"text": "hola"})
        assert resp.status_code == 401


# -- capture/turn (text) ------------------------------------------------


def test_capture_turn_saves_observation_when_complete(monkeypatch):
    _reset_fake_router()
    _FakeRouterClient.responses = {"completion": COMPLETE_EXTRACTION}
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakeRouterClient)

    with TestClient(app) as client:
        token = _login(client)
        resp = client.post(
            "/capture/turn", json={"text": "two MR at Hospital Test in Panama"}, headers=_auth_headers(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["done"] is True
        assert len(body["saved_observations"]) == 1
        saved = body["saved_observations"][0]
        assert saved["customer"] == "Hospital Test"
        assert saved["observer"] == "Field User 01"  # from the authenticated technician, not client input


def test_capture_turn_asks_follow_up_when_incomplete(monkeypatch):
    _reset_fake_router()
    _FakeRouterClient.responses = {"completion": INCOMPLETE_EXTRACTION}
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakeRouterClient)

    with TestClient(app) as client:
        token = _login(client)
        resp = client.post("/capture/turn", json={"text": "they have some CTs"}, headers=_auth_headers(token))
        body = resp.json()
        assert body["done"] is False
        assert body["agent_message"] == "Which hospital?"
        assert body["saved_observations"] == []


def test_capture_turn_returns_503_when_no_peer_available(monkeypatch):
    _reset_fake_router()  # no capabilities registered -> Router would 503
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakeRouterClient)

    with TestClient(app) as client:
        token = _login(client)
        resp = client.post("/capture/turn", json={"text": "hola"}, headers=_auth_headers(token))
        assert resp.status_code == 503


def test_capture_turn_is_idempotent_with_client_event_id(monkeypatch):
    _reset_fake_router()
    _FakeRouterClient.responses = {"completion": COMPLETE_EXTRACTION}
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakeRouterClient)

    with TestClient(app) as client:
        token = _login(client)
        payload = {"text": "two MR at Hospital Test in Panama", "client_event_id": "evt-1"}
        first = client.post("/capture/turn", json=payload, headers=_auth_headers(token))
        second = client.post("/capture/turn", json=payload, headers=_auth_headers(token))

        assert first.json() == second.json()
        # Only one round-trip to the Router actually happened -- the retry
        # was answered from cache, not reprocessed (no duplicate observation).
        assert len(_FakeRouterClient.calls) == 1


# -- capture/turn/voice ---------------------------------------------------


def test_capture_turn_voice_transcribes_and_saves(monkeypatch):
    _reset_fake_router()
    _FakeRouterClient.responses = {
        "transcription": "two MR at Hospital Test in Panama",
        "completion": COMPLETE_EXTRACTION,
    }
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakeRouterClient)

    with TestClient(app) as client:
        token = _login(client)
        resp = client.post(
            "/capture/turn/voice",
            files={"audio": ("note.wav", io.BytesIO(b"fake-audio-bytes"), "audio/wav")},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["done"] is True
        assert body["saved_observations"][0]["source"] == "voice"


def test_capture_turn_voice_requires_auth():
    with TestClient(app) as client:
        resp = client.post(
            "/capture/turn/voice", files={"audio": ("note.wav", io.BytesIO(b"x"), "audio/wav")}
        )
        assert resp.status_code == 401


# -- photos ---------------------------------------------------------------


def test_photo_upload_queues_as_pending():
    with TestClient(app) as client:
        token = _login(client)
        resp = client.post(
            "/photos",
            files={"photo": ("plate.jpg", io.BytesIO(b"fake-jpeg-bytes"), "image/jpeg")},
            data={"customer": "Hospital Test"},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "pending"
        assert body["customer"] == "Hospital Test"


def test_photo_upload_requires_auth():
    with TestClient(app) as client:
        resp = client.post("/photos", files={"photo": ("plate.jpg", io.BytesIO(b"x"), "image/jpeg")})
        assert resp.status_code == 401


def test_validate_photo_confirmed_creates_observation():
    with TestClient(app) as client:
        token = _login(client)
        upload = client.post(
            "/photos",
            files={"photo": ("plate.jpg", io.BytesIO(b"fake"), "image/jpeg")},
            data={"customer": "Hospital Test"},
            headers=_auth_headers(token),
        )
        photo_id = upload.json()["id"]

        from app.main import store as installed_base_store

        installed_base_store.mark_photo_needs_review(photo_id, "MR", "NovaMed", "NM-MR700", "high")

        resp = client.post(
            f"/photos/{photo_id}/validate", json={"confirmed": True}, headers=_auth_headers(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["customer"] == "Hospital Test"
        assert body["modality"] == "MR"
        assert body["status"] == "confirmed"
        assert body["source"] == "photo"

        photos = client.get("/photos?status=confirmed").json()
        assert any(p["id"] == photo_id for p in photos)


def test_validate_photo_rejected_uses_correction():
    with TestClient(app) as client:
        token = _login(client)
        upload = client.post(
            "/photos",
            files={"photo": ("plate.jpg", io.BytesIO(b"fake"), "image/jpeg")},
            data={"customer": "Hospital Test"},
            headers=_auth_headers(token),
        )
        photo_id = upload.json()["id"]

        from app.main import store as installed_base_store

        installed_base_store.mark_photo_needs_review(photo_id, "CT", None, None, "low")

        resp = client.post(
            f"/photos/{photo_id}/validate",
            json={"confirmed": False, "correction": {"modality": "MR", "brand": "NovaMed"}},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["modality"] == "MR"
        assert body["brand"] == "NovaMed"

        photos = client.get("/photos?status=rejected").json()
        assert photos[0]["corrected_label"] == "MR"


def test_validate_photo_not_awaiting_review_returns_400():
    with TestClient(app) as client:
        token = _login(client)
        upload = client.post(
            "/photos",
            files={"photo": ("plate.jpg", io.BytesIO(b"fake"), "image/jpeg")},
            data={"customer": "Hospital Test"},
            headers=_auth_headers(token),
        )
        photo_id = upload.json()["id"]  # still "pending", not "needs_review"

        resp = client.post(
            f"/photos/{photo_id}/validate", json={"confirmed": True}, headers=_auth_headers(token)
        )
        assert resp.status_code == 400


# -- natural language query -----------------------------------------------


def test_query_filters_by_interpreted_country_and_modality(monkeypatch):
    _reset_fake_router()
    _FakeRouterClient.responses = {"completion": '{"country": "Panama", "modality": "MR"}'}
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakeRouterClient)

    with TestClient(app) as client:
        resp = client.post("/query", json={"question": "customers in Panama with MR systems"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["interpreted_filter"] == {"country": "Panama", "modality": "MR"}
        assert all(r["country"] == "Panama" and r["modality"] == "MR" for r in body["results"])
        assert len(body["results"]) >= 1


def test_query_returns_503_when_no_peer_available(monkeypatch):
    _reset_fake_router()
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakeRouterClient)

    with TestClient(app) as client:
        resp = client.post("/query", json={"question": "anything"})
        assert resp.status_code == 503


# -- offline sync (technician app's local SQLite queue) --------------------


def _sync_item(local_id: int, **overrides) -> dict:
    item = {
        "local_id": local_id,
        "customer": "Hospital Sync",
        "city": None,
        "country": "Panama",
        "modality": "MR",
        "quantity": 1,
        "brand": "NovaMed",
        "model": None,
        "approx_age_years": 5,
        "confidence": "high",
        "status": "reported",
        "source": "text",
        "observer": "Someone the client made up",
        "visit_date": "2026-09-09",
    }
    item.update(overrides)
    return item


def test_sync_requires_auth():
    with TestClient(app) as client:
        resp = client.post("/sync", json={"pending_observations": [_sync_item(1)]})
        assert resp.status_code == 401


def test_sync_accepts_batch_and_uses_authenticated_observer():
    with TestClient(app) as client:
        token = _login(client)
        resp = client.post(
            "/sync", json={"pending_observations": [_sync_item(1), _sync_item(2)]}, headers=_auth_headers(token)
        )
        assert resp.status_code == 200
        accepted = resp.json()["accepted"]
        assert [a["local_id"] for a in accepted] == [1, 2]

        detail = client.get("/customers/Hospital Sync")
        assert detail.status_code == 200
        # observer comes from the token, never the client-sent field
        assert all(o["observer"] == "Field User 01" for o in detail.json())


def test_sync_is_idempotent_per_local_id():
    with TestClient(app) as client:
        token = _login(client)
        payload = {"pending_observations": [_sync_item(1)]}
        first = client.post("/sync", json=payload, headers=_auth_headers(token))
        second = client.post("/sync", json=payload, headers=_auth_headers(token))
        assert first.json()["accepted"] == second.json()["accepted"]

        detail = client.get("/customers/Hospital Sync")
        assert len(detail.json()) == 1  # not duplicated

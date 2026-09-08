from fastapi.testclient import TestClient

from app.main import app


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self):
        return self._payload


class _FakePeerAsyncClient:
    """Stands in for httpx.AsyncClient inside app.extraction: fakes both the
    Router's /peers listing and a Peer's /infer, so /capture/turn can be
    tested without a real mesh running."""

    _ANSWER = (
        '{"customer": "Hospital Test", "city": null, "country": "Panama", '
        '"equipment": [{"modality": "MR", "quantity": 2, "brand": "NovaMed", '
        '"model": null, "approx_age_years": 7, "confidence": "high", "status": "reported"}], '
        '"missing_required": [], "follow_up_question": null, "ready_to_save": true}'
    )

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self) -> "_FakePeerAsyncClient":
        return self

    async def __aexit__(self, *exc) -> bool:
        return False

    async def get(self, url: str, **kwargs) -> _FakeResponse:
        assert url.endswith("/peers")
        return _FakeResponse([{"node_id": "peer-medium", "available": True, "base_url": "http://peer-medium:8000"}])

    async def post(self, url: str, json: dict | None = None, **kwargs) -> _FakeResponse:
        assert url.endswith("/infer")
        return _FakeResponse({"answer": self._ANSWER})


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


def test_capture_turn_saves_observation_when_complete(monkeypatch):
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _FakePeerAsyncClient)
    with TestClient(app) as client:
        resp = client.post("/capture/turn", json={"text": "two MR at Hospital Test in Panama"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["done"] is True
        assert len(body["saved_observations"]) == 1
        assert body["saved_observations"][0]["customer"] == "Hospital Test"


def test_capture_turn_asks_follow_up_when_incomplete(monkeypatch):
    class _IncompletePeerClient(_FakePeerAsyncClient):
        async def post(self, url: str, json: dict | None = None, **kwargs) -> _FakeResponse:
            answer = (
                '{"customer": null, "equipment": [], "missing_required": ["customer"], '
                '"follow_up_question": "Which hospital?", "ready_to_save": false}'
            )
            return _FakeResponse({"answer": answer})

    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _IncompletePeerClient)
    with TestClient(app) as client:
        resp = client.post("/capture/turn", json={"text": "they have some CTs"})
        body = resp.json()
        assert body["done"] is False
        assert body["agent_message"] == "Which hospital?"
        assert body["saved_observations"] == []


def test_capture_turn_returns_503_when_no_peer_available(monkeypatch):
    class _NoPeerClient(_FakePeerAsyncClient):
        async def get(self, url: str, **kwargs) -> _FakeResponse:
            return _FakeResponse([])

    monkeypatch.setattr("app.extraction.httpx.AsyncClient", _NoPeerClient)
    with TestClient(app) as client:
        resp = client.post("/capture/turn", json={"text": "hola"})
        assert resp.status_code == 503

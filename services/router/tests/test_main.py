from fastapi.testclient import TestClient
from qvac_mesh_shared import ModelTier, NodeRole, PeerCapability

from app.main import app
from app.peer_registry import registry


def setup_function():
    registry._peers.clear()


def _register(client: TestClient, node_id: str, role: str, tier: str) -> None:
    cap = {
        "node_id": node_id,
        "role": role,
        "model_tier": tier,
        "model_name": "LLAMA_3_2_1B_INST_Q4_0",
        "base_url": f"http://{node_id}:8000",
        "available": True,
        "price_per_1k_tokens": 0,
    }
    resp = client.post("/peers/register", json=cap)
    assert resp.status_code == 200


def test_health_reports_known_peer_count():
    with TestClient(app) as client:
        assert client.get("/health").json()["known_peers"] == 0
        _register(client, "peer-medium", "medium_provider", "medium")
        assert client.get("/health").json()["known_peers"] == 1


def test_register_and_list_peers():
    with TestClient(app) as client:
        _register(client, "peer-medium", "medium_provider", "medium")
        peers = client.get("/peers").json()
        assert len(peers) == 1
        assert peers[0]["node_id"] == "peer-medium"


def test_route_without_peers_returns_503():
    with TestClient(app) as client:
        resp = client.post("/route", json={"query": "hola"})
        assert resp.status_code == 503


def test_route_with_peer_returns_plan():
    with TestClient(app) as client:
        _register(client, "peer-medium", "medium_provider", "medium")
        resp = client.post("/route", json={"query": "hola"})
        assert resp.status_code == 200
        assert resp.json()["target_node_id"] == "peer-medium"


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    """Stands in for httpx.AsyncClient so /ask can be tested end to end
    without a real RAG service or Peer running."""

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self) -> "_FakeAsyncClient":
        return self

    async def __aexit__(self, *exc) -> bool:
        return False

    async def post(self, url: str, json: dict | None = None, **kwargs) -> _FakeResponse:
        if url.endswith("/search"):
            return _FakeResponse({"context": "ctx", "sources": [], "sensitivity": "internal"})
        if url.endswith("/infer"):
            return _FakeResponse(
                {
                    "request_id": json["request_id"],
                    "node_id": "peer-medium",
                    "model": "LLAMA_3_2_1B_INST_Q4_0",
                    "answer": "respuesta de prueba",
                    "duration_ms": 10.0,
                    "tokens_in": 2,
                    "tokens_out": 3,
                    "cost": 0.0,
                }
            )
        raise AssertionError(f"unexpected URL in test: {url}")


def test_ask_runs_full_flow_with_mocked_rag_and_peer(monkeypatch):
    registry.upsert(
        PeerCapability(
            node_id="peer-medium",
            role=NodeRole.MEDIUM_PROVIDER,
            model_tier=ModelTier.MEDIUM,
            model_name="LLAMA_3_2_1B_INST_Q4_0",
            base_url="http://peer-medium:8000",
        )
    )
    monkeypatch.setattr("app.main.httpx.AsyncClient", _FakeAsyncClient)

    with TestClient(app) as client:
        resp = client.post("/ask", json={"query": "hola"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["answer"] == "respuesta de prueba"
        assert body["plan"]["target_node_id"] == "peer-medium"
        assert body["usage"]["settlement_status"] == "not_implemented"

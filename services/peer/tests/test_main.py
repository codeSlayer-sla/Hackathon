from fastapi.testclient import TestClient

from app.main import app


def test_health_and_capabilities_agree_on_node_id():
    with TestClient(app) as client:
        health = client.get("/health").json()
        assert health["status"] == "ok"

        caps = client.get("/capabilities").json()
        assert caps["node_id"] == health["node_id"]
        # No QVAC worker in the test environment -> not ready, but the
        # service must still boot and answer.
        assert caps["available"] is health["qvac_ready"]


def test_infer_returns_stub_answer_when_model_not_loaded():
    with TestClient(app) as client:
        resp = client.post("/infer", json={"request_id": "r1", "query": "hola", "context": None})
        assert resp.status_code == 200
        body = resp.json()
        assert "stub" in body["answer"].lower()
        assert body["request_id"] == "r1"
        assert body["duration_ms"] >= 0


def test_infer_generates_request_id_when_missing():
    with TestClient(app) as client:
        resp = client.post("/infer", json={"request_id": "", "query": "hola"})
        assert resp.status_code == 200
        assert resp.json()["request_id"]

from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_status():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


def test_search_falls_back_and_finds_relevant_doc():
    # No QVAC worker/model in the test environment -> exercises the keyword
    # search fallback, which must still answer the demo questions correctly.
    with TestClient(app) as client:
        resp = client.post("/search", json={"query": "papercut myq impresion"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["sources"]
        assert any(s["doc_id"] == "infra-001" for s in body["sources"])
        assert body["sensitivity"] == "internal"


def test_search_respects_top_k():
    with TestClient(app) as client:
        resp = client.post("/search", json={"query": "servidor", "top_k": 1})
        assert resp.status_code == 200
        assert len(resp.json()["sources"]) == 1


def test_search_never_returns_empty_context():
    with TestClient(app) as client:
        resp = client.post("/search", json={"query": "algo totalmente sin relacion xyz"})
        assert resp.status_code == 200
        assert resp.json()["context"]

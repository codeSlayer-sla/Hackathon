import importlib

from fastapi.testclient import TestClient

from app import main as main_module
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
        assert caps["capabilities"] == ["completion"]


def test_infer_rejects_image_path_on_non_multimodal_peer():
    with TestClient(app) as client:
        resp = client.post("/infer", json={"request_id": "r1", "query": "hola", "image_path": "/tmp/x.jpg"})
        assert resp.status_code == 400


def test_transcribe_rejects_on_non_transcription_peer():
    with TestClient(app) as client:
        resp = client.post("/transcribe", json={"request_id": "r1", "audio_path": "/tmp/a.wav"})
        assert resp.status_code == 400


def test_transcribe_stub_on_transcription_peer(monkeypatch):
    monkeypatch.setenv("MODEL_KIND", "transcription")
    monkeypatch.setenv("MODEL_NAME", "WHISPER_TINY")
    importlib.reload(main_module)
    try:
        with TestClient(main_module.app) as client:
            caps = client.get("/capabilities").json()
            assert caps["capabilities"] == ["transcription"]

            resp = client.post("/transcribe", json={"request_id": "r1", "audio_path": "/tmp/a.wav"})
            assert resp.status_code == 200
            body = resp.json()
            assert "stub" in body["text"].lower()

            # A transcription peer still refuses /infer with an image (it's
            # not multimodal).
            resp = client.post("/infer", json={"request_id": "r2", "query": "hola", "image_path": "/tmp/x.jpg"})
            assert resp.status_code == 400
    finally:
        monkeypatch.undo()
        importlib.reload(main_module)


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

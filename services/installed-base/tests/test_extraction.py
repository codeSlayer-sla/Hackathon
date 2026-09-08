import pytest

from app import extraction


def test_parse_extraction_valid_json():
    raw = (
        '{"customer": "Hospital Alpha", "city": null, "country": "Panama", '
        '"equipment": [{"modality": "MR", "quantity": 2, "brand": null, "model": null, '
        '"approx_age_years": null, "confidence": "medium", "status": "reported"}], '
        '"missing_required": [], "follow_up_question": null, "ready_to_save": true}'
    )
    result = extraction.parse_extraction(raw)
    assert result["customer"] == "Hospital Alpha"
    assert result["ready_to_save"] is True
    assert len(result["equipment"]) == 1


def test_parse_extraction_json_embedded_in_prose():
    raw = 'Sure, here you go:\n{"customer": "Hospital Alpha", "equipment": [], "ready_to_save": false}\nHope that helps!'
    result = extraction.parse_extraction(raw)
    assert result["customer"] == "Hospital Alpha"
    assert result["equipment"] == []


def test_parse_extraction_malformed_json_falls_back_safely():
    result = extraction.parse_extraction("not json at all, sorry")
    assert result["ready_to_save"] is False
    assert result["follow_up_question"]
    assert result["equipment"] == []


def test_parse_extraction_defaults_missing_optional_keys():
    result = extraction.parse_extraction('{"customer": "X"}')
    assert result["equipment"] == []
    assert result["missing_required"] == []
    assert result["ready_to_save"] is False


def test_build_prompt_includes_full_transcript():
    prompt = extraction.build_text_prompt(["hola", "mundo"])
    assert "User: hola" in prompt
    assert "User: mundo" in prompt
    assert prompt.strip().endswith("JSON:")


def test_parse_photo_identification_valid_json():
    raw = '{"modality": "MR", "brand": "NovaMed", "model": null, "confidence": "high", "reasoning": "clear label"}'
    result = extraction.parse_photo_identification(raw)
    assert result["modality"] == "MR"
    assert result["brand"] == "NovaMed"


def test_parse_photo_identification_falls_back_on_malformed_json():
    result = extraction.parse_photo_identification("not json")
    assert result["modality"] is None
    assert result["confidence"] == "low"


def test_build_query_prompt_includes_question():
    prompt = extraction.build_query_prompt("customers in Brazil with MR older than 7 years")
    assert "customers in Brazil with MR older than 7 years" in prompt


def test_parse_query_filter_valid_json():
    raw = '{"country": "Brazil", "modality": "MR", "min_age_years": 7}'
    result = extraction.parse_query_filter(raw)
    assert result == {"country": "Brazil", "modality": "MR", "min_age_years": 7}


def test_parse_query_filter_falls_back_to_empty_dict_on_malformed_json():
    assert extraction.parse_query_filter("not json") == {}


class _FakeAsyncClient503:
    def __init__(self, *a, **kw) -> None:
        pass

    async def __aenter__(self) -> "_FakeAsyncClient503":
        return self

    async def __aexit__(self, *exc) -> bool:
        return False

    async def post(self, url, json=None, **kwargs):
        class _Resp:
            status_code = 503

            def json(self):
                return {"detail": "No peer with capability 'multimodal' is registered/available"}

        return _Resp()


@pytest.mark.anyio
async def test_router_infer_raises_runtime_error_on_503(monkeypatch):
    monkeypatch.setattr(extraction.httpx, "AsyncClient", _FakeAsyncClient503)
    with pytest.raises(RuntimeError, match="multimodal"):
        await extraction.identify_photo("http://router:8000", "/data/media/photos/x.jpg")

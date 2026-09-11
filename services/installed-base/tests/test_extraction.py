import io

import pytest
from PIL import Image

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


def _make_jpeg_bytes(width: int, height: int, color: tuple = (120, 120, 120)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_prepare_photo_bytes_resizes_large_image_to_max_dimension():
    out = extraction.prepare_photo_bytes(_make_jpeg_bytes(5000, 3000))
    with Image.open(io.BytesIO(out)) as image:
        assert max(image.size) == extraction._PHOTO_MAX_DIMENSION
        assert min(image.size) == 768


def test_prepare_photo_bytes_preserves_aspect_ratio():
    out = extraction.prepare_photo_bytes(_make_jpeg_bytes(4000, 2000))
    with Image.open(io.BytesIO(out)) as image:
        assert max(image.size) == extraction._PHOTO_MAX_DIMENSION
        assert image.size == (1280, 640)


def test_prepare_photo_bytes_leaves_small_image_untouched():
    out = extraction.prepare_photo_bytes(_make_jpeg_bytes(640, 480))
    with Image.open(io.BytesIO(out)) as image:
        assert image.size == (640, 480)
        assert image.format == "JPEG"


def test_prepare_photo_bytes_outputs_valid_jpeg():
    out = extraction.prepare_photo_bytes(_make_jpeg_bytes(3000, 2000))
    with Image.open(io.BytesIO(out)) as image:
        assert image.format == "JPEG"
        image.verify()


def test_prepare_photo_bytes_invalid_image_passthrough():
    data = b"not-an-image"
    assert extraction.prepare_photo_bytes(data) is data
    assert extraction.prepare_photo_bytes(b"") == b""


def test_photo_instructions_still_define_expected_shape():
    for field in ("modality", "brand", "model", "confidence", "reasoning"):
        assert field in extraction._PHOTO_INSTRUCTIONS
    assert "no prose, no markdown fences" in extraction._PHOTO_INSTRUCTIONS


def test_build_query_prompt_includes_question():
    prompt = extraction.build_query_prompt("customers in Brazil with MR older than 7 years")
    assert "customers in Brazil with MR older than 7 years" in prompt


def test_parse_query_filter_valid_json():
    raw = '{"country": "Brazil", "modality": "MR", "min_age_years": 7}'
    result = extraction.parse_query_filter(raw)
    assert result == {"country": "Brazil", "modality": "MR", "min_age_years": 7}


def test_parse_query_filter_falls_back_to_empty_dict_on_malformed_json():
    assert extraction.parse_query_filter("not json") == {}


def test_parse_extraction_fenced_json():
    raw = (
        '```json\n'
        '{"customer": "Hospital Alpha", "city": null, "country": "Panama", '
        '"equipment": [], "missing_required": [], "follow_up_question": null, "ready_to_save": true}\n'
        '```'
    )
    result = extraction.parse_extraction(raw)
    assert result["customer"] == "Hospital Alpha"
    assert result["ready_to_save"] is True


def test_parse_photo_identification_fenced_json():
    raw = '```json\n{"modality": "MR", "brand": "NovaMed", "model": "NM-MR700", "confidence": "high", "reasoning": "clear label"}\n```'
    result = extraction.parse_photo_identification(raw)
    assert result["modality"] == "MR"
    assert result["brand"] == "NovaMed"
    assert result["confidence"] == "high"


def test_parse_extraction_prose_before_and_after_json():
    raw = (
        "Claro, esta es la informacion:\n"
        '{"customer": "Hospital Alpha", "equipment": [], "missing_required": [], "ready_to_save": false}\n'
        "Espero que ayude!"
    )
    result = extraction.parse_extraction(raw)
    assert result["customer"] == "Hospital Alpha"


def test_parse_extraction_first_valid_object_wins():
    raw = 'Here: {"customer": "Hospital Alpha", "ready_to_save": true} and also note {this is not json}'
    result = extraction.parse_extraction(raw)
    assert result["customer"] == "Hospital Alpha"
    assert result["ready_to_save"] is True


def test_parse_extraction_first_valid_object_wins_over_trailing_braces():
    raw = (
        '{"customer": "Hospital Beta", "equipment": []}\n'
        "\n"
        "Obs: otra cosa con llaves {esto no es json ni cierra bien"
    )
    result = extraction.parse_extraction(raw)
    assert result["customer"] == "Hospital Beta"


def test_parse_extraction_fence_only_output_falls_back():
    result = extraction.parse_extraction("```")
    assert result["ready_to_save"] is False
    assert result["follow_up_question"]
    assert result["equipment"] == []


def test_parse_photo_identification_truncated_fenced_output_falls_back():
    result = extraction.parse_photo_identification('```json\n{"modality": "MR", "brand": "NovaMed"')
    assert result["modality"] is None
    assert result["confidence"] == "low"


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

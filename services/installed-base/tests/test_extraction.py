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
    prompt = extraction.build_prompt(["hola", "mundo"])
    assert "User: hola" in prompt
    assert "User: mundo" in prompt
    assert prompt.strip().endswith("JSON:")

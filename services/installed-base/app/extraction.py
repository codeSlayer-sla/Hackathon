"""Turns a field colleague's natural-language observation into structured
equipment data, using the mesh's Router for the actual inference -- this
module never discovers or calls a Peer directly, it only ever talks to
`ROUTER_URL/infer`. That's what makes the hard requirement ("QVAC
on-device or P2P, never cloud") true by construction *and* keeps the
Router as the single place that decides which model/peer handles a
request, as it was always meant to (RAG/completion routing already worked
this way; photo/voice capabilities now go through the same door).

Extraction is prompt-based (ask the model for a single JSON object) with
defensive parsing, not grammar-constrained decoding -- `completion()` in
`tetherto-qvac-sdk` does accept a `response_format` param that could force
valid JSON, but its exact accepted shape wasn't verified against the
installed SDK version in time for this pass. Documented as a follow-up in
the README; prompting + defensive parsing is the safe MVP path.
"""

from __future__ import annotations

import json
import logging
import re
import uuid

import httpx

logger = logging.getLogger("installed_base.extraction")

_TEXT_INSTRUCTIONS = """You extract structured installed-base equipment data from a field colleague's observation about a hospital/clinic visit.

Extract, when known:
- customer: hospital/facility name
- city, country
- equipment: a list of {"modality", "quantity", "brand", "model", "approx_age_years", "confidence", "status"}
  - modality: a short label such as MR, CT, Ultrasound, X-Ray, Patient Monitoring, Image Guided Therapy
  - confidence: "high" | "medium" | "low" based on how certain the speaker sounds
  - status: "reported" (stated as directly observed fact), "estimated" (a guess, e.g. approximate age), or "unknown" (not stated)
- missing_required: which required fields are still missing. Required: customer, at least one of city/country, and at least one equipment entry with modality and quantity.
- follow_up_question: one short natural question asking for the single most valuable missing piece of information, or null if nothing required is missing
- ready_to_save: true only if missing_required is empty

Respond with ONLY one JSON object, no prose, no markdown fences, exactly matching this shape:
{"customer": string|null, "city": string|null, "country": string|null, "equipment": [{"modality": string, "quantity": number|null, "brand": string|null, "model": string|null, "approx_age_years": number|null, "confidence": string, "status": string}], "missing_required": [string], "follow_up_question": string|null, "ready_to_save": boolean}

Example 1
User: "I am at Hospital DemoCare Pacific in Panama. They have two MR systems and one CT."
JSON: {"customer": "Hospital DemoCare Pacific", "city": null, "country": "Panama", "equipment": [{"modality": "MR", "quantity": 2, "brand": null, "model": null, "approx_age_years": null, "confidence": "medium", "status": "reported"}, {"modality": "CT", "quantity": 1, "brand": null, "model": null, "approx_age_years": null, "confidence": "medium", "status": "reported"}], "missing_required": [], "follow_up_question": "Do you know the brand of the MR or CT systems?", "ready_to_save": true}

Example 2
User: "They have two CTs."
JSON: {"customer": null, "city": null, "country": null, "equipment": [{"modality": "CT", "quantity": 2, "brand": null, "model": null, "approx_age_years": null, "confidence": "low", "status": "reported"}], "missing_required": ["customer", "city_or_country"], "follow_up_question": "Which hospital or customer is this, and in what city or country?", "ready_to_save": false}

Conversation so far (most recent last):
"""

_TEXT_FALLBACK = {
    "customer": None,
    "city": None,
    "country": None,
    "equipment": [],
    "missing_required": ["customer"],
    "follow_up_question": "Sorry, I couldn't parse that -- could you rephrase which hospital and what equipment you saw?",
    "ready_to_save": False,
}

_PHOTO_INSTRUCTIONS = """Look at the attached photo of a piece of hospital equipment (or its label/nameplate).

Identify, when visible:
- modality: a short label such as MR, CT, Ultrasound, X-Ray, Patient Monitoring, Image Guided Therapy
- brand: the manufacturer name if visible on a label
- model: the model/product name if visible
- confidence: "high" | "medium" | "low" based on how clearly the label/equipment is visible
- reasoning: one short sentence on what you saw that led to this guess

Respond with ONLY one JSON object, no prose, no markdown fences:
{"modality": string|null, "brand": string|null, "model": string|null, "confidence": string, "reasoning": string}
"""

_PHOTO_FALLBACK = {
    "modality": None,
    "brand": None,
    "model": None,
    "confidence": "low",
    "reasoning": "Could not analyze the image (peer unavailable or response unparsable).",
}

_QUERY_INSTRUCTIONS = """Translate this question about an installed-base equipment dataset into a JSON filter.

Fields (all optional, omit what the question doesn't specify):
{"country": string, "modality": string, "min_age_years": number, "max_age_years": number, "status": string, "confidence": string}

Respond with ONLY one JSON object, no prose, no markdown fences.

Example
Question: "customers in Brazil with MR systems older than 7 years"
JSON: {"country": "Brazil", "modality": "MR", "min_age_years": 7}

Question: """

_QUERY_FALLBACK: dict = {}


def build_text_prompt(transcript: list[str]) -> str:
    convo = "\n".join(f"User: {line}" for line in transcript)
    return f"{_TEXT_INSTRUCTIONS}{convo}\nJSON:"


def build_query_prompt(question: str) -> str:
    return f"{_QUERY_INSTRUCTIONS}{question}\nJSON:"


def _safe_parse_json(raw_answer: str, fallback: dict, defaults: dict | None = None) -> dict:
    match = re.search(r"\{.*\}", raw_answer, re.S)
    if not match:
        logger.warning("No JSON object found in model answer: %r", raw_answer[:200])
        return dict(fallback)
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        logger.warning("Malformed JSON in model answer: %r", raw_answer[:200])
        return dict(fallback)
    for key, value in (defaults or {}).items():
        parsed.setdefault(key, value)
    return parsed


def parse_extraction(raw_answer: str) -> dict:
    return _safe_parse_json(
        raw_answer,
        _TEXT_FALLBACK,
        defaults={"equipment": [], "missing_required": [], "follow_up_question": None, "ready_to_save": False},
    )


def parse_photo_identification(raw_answer: str) -> dict:
    return _safe_parse_json(raw_answer, _PHOTO_FALLBACK, defaults=dict(_PHOTO_FALLBACK))


def parse_query_filter(raw_answer: str) -> dict:
    return _safe_parse_json(raw_answer, _QUERY_FALLBACK)


async def _router_infer(router_url: str, **payload) -> str:
    payload.setdefault("request_id", str(uuid.uuid4()))
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(f"{router_url}/infer", json=payload)
        if resp.status_code == 503:
            raise RuntimeError(resp.json().get("detail", "Router has no available peer for this capability"))
        resp.raise_for_status()
        return resp.json()["text"]


async def extract_from_transcript(router_url: str, transcript: list[str]) -> dict:
    prompt = build_text_prompt(transcript)
    answer = await _router_infer(router_url, capability="completion", query=prompt)
    return parse_extraction(answer)


async def identify_photo(router_url: str, image_path: str) -> dict:
    answer = await _router_infer(
        router_url, capability="multimodal", query=_PHOTO_INSTRUCTIONS, image_path=image_path
    )
    return parse_photo_identification(answer)


async def transcribe_audio(router_url: str, audio_path: str) -> str:
    return await _router_infer(router_url, capability="transcription", audio_path=audio_path)


async def interpret_query(router_url: str, question: str) -> dict:
    prompt = build_query_prompt(question)
    answer = await _router_infer(router_url, capability="completion", query=prompt)
    return parse_query_filter(answer)

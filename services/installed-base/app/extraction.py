"""Turns a field colleague's natural-language observation into structured
equipment data, using a real QVAC peer for the actual inference -- this
module never calls anything but the mesh's own Peer (`POST /infer`), which
is what makes the hard requirement ("QVAC on-device or P2P, never cloud")
true by construction: nothing here can reach a cloud API even by accident.

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

_INSTRUCTIONS = """You extract structured installed-base equipment data from a field colleague's observation about a hospital/clinic visit.

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

_FALLBACK_RESULT = {
    "customer": None,
    "city": None,
    "country": None,
    "equipment": [],
    "missing_required": ["customer"],
    "follow_up_question": "Sorry, I couldn't parse that -- could you rephrase which hospital and what equipment you saw?",
    "ready_to_save": False,
}


def build_prompt(transcript: list[str]) -> str:
    convo = "\n".join(f"User: {line}" for line in transcript)
    return f"{_INSTRUCTIONS}{convo}\nJSON:"


def parse_extraction(raw_answer: str) -> dict:
    match = re.search(r"\{.*\}", raw_answer, re.S)
    if not match:
        logger.warning("No JSON object found in extraction answer: %r", raw_answer[:200])
        return dict(_FALLBACK_RESULT)
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        logger.warning("Malformed JSON in extraction answer: %r", raw_answer[:200])
        return dict(_FALLBACK_RESULT)

    parsed.setdefault("equipment", [])
    parsed.setdefault("missing_required", [])
    parsed.setdefault("follow_up_question", None)
    parsed.setdefault("ready_to_save", False)
    return parsed


async def pick_peer_base_url(router_url: str) -> str:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{router_url}/peers")
        resp.raise_for_status()
        peers = resp.json()

    available = [p for p in peers if p.get("available")]
    if not available:
        raise RuntimeError("No QVAC peer is registered/available yet")
    return available[0]["base_url"]


async def call_peer(peer_base_url: str, prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{peer_base_url}/infer",
            json={"request_id": str(uuid.uuid4()), "query": prompt, "context": None},
        )
        resp.raise_for_status()
        return resp.json()["answer"]


async def extract_from_transcript(router_url: str, transcript: list[str]) -> dict:
    peer_base_url = await pick_peer_base_url(router_url)
    prompt = build_prompt(transcript)
    answer = await call_peer(peer_base_url, prompt)
    return parse_extraction(answer)

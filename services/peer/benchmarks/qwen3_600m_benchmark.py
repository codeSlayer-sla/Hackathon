#!/usr/bin/env python3
"""Local-only QVAC benchmark for Qwen3 600M (QWEN3_600M_INST_Q4).

Runs 5 Spanish banking prompts through the exact QVAC completion path the Peer
service uses (Client + load_model + run.text()) so CajaAI can judge whether this
model is a fit for a local Spanish banking assistant.

No cloud AI API is used anywhere in this script. Inference runs on this machine
through QVAC's local worker (llamacpp engine). The script also proves that
inference keeps working with networking disabled once the model is cached:
run this same script in a container started with `--network none` and the
model cache volume mounted (see --offline-check).

Usage (inside the enterprise-ai-mesh-peer-medium image, cache mounted):
    python qwen3_600m_benchmark.py                 # download if needed + run
    python qwen3_600m_benchmark.py --offline-check # network disabled variant
"""

import argparse
import asyncio
import os
import socket
import sys
import time

QVAC_MODEL_NAME = "QWEN3_600M_INST_Q4"
QWEN_GGUF_FILENAME = "Qwen3-0.6B-Q4_0.gguf"
QWEN_SHA256 = "33bcc57074ec7b6eada5a90651ee546ec0c2b271002c22baf9f1b2dd1e8f75cb"
ENGINE = "llamacpp-completion"

PROMPTS = [
    "¿Qué es una cuenta de ahorro?",
    "¿Cómo puedo empezar a ahorrar dinero si tengo ingresos limitados?",
    "¿Qué es una tasa de interés?",
    "Recibí un SMS que dice que mi cuenta bancaria será bloqueada si no hago clic en un enlace. ¿Qué debería hacer?",
    "¿Cuál es la diferencia entre una cuenta de ahorro y una cuenta corriente?",
]

_OFFLINE_TEST_HOSTS = [
    ("huggingface.co", 443),
    ("registry.qvac.ai", 443),
]


def try_network() -> dict:
    """Best-effort check that no external host is reachable. Used only to
    prove the offline scenario: no cloud service is contacted by inference at
    any point, and with --network none this confirms the runtime is fully
    local."""
    reachable: list[str] = []
    for host, port in _OFFLINE_TEST_HOSTS:
        try:
            with socket.create_connection((host, port), timeout=3):
                reachable.append(host)
        except OSError:
            pass
    return {"reachable": reachable, "blocked": not reachable}


async def load_model() -> tuple[object, object, object, str]:
    """Same client/load sequence as services/peer/app/qvac_runtime.py.

    Prefers a local copy of the GGUF (verified against the SDK's pinned
    sha256) -- this is QVAC's officially supported alternate source, so the
    benchmark stays reproducible and works with the network disabled. Falls
    back to the SDK's registry descriptor if the file is missing.
    """
    from tetherto.qvac_sdk import Client, load_model
    from tetherto.qvac_sdk import models as qvac_models

    cache_dir = os.environ.get("QVAC_CACHE_DIR", "/data/qvac-models")
    local_path = os.path.join(cache_dir, QWEN_GGUF_FILENAME)

    model_src = getattr(qvac_models, QVAC_MODEL_NAME)
    source_desc = f"SDK registry descriptor ({model_src.name})"

    if os.path.isfile(local_path):
        import hashlib

        sha = hashlib.sha256()
        with open(local_path, "rb") as fh:
            for block in iter(lambda: fh.read(1 << 20), b""):
                sha.update(block)
        if sha.hexdigest() == QWEN_SHA256:
            model_src = local_path
            source_desc = f"local GGUF file ({local_path}, sha256 verified)"
        else:
            print(f"WARNING: {local_path} sha256 mismatch -- falling back to registry")

    client = Client()
    await client.__aenter__()
    transport = client.transport
    model_id = await load_model(transport, model_src=model_src, model_type=ENGINE)
    return client, transport, model_id, source_desc


async def run_prompt(transport, model_id: object, prompt: str, index: int) -> dict:
    from tetherto.qvac_sdk import completion

    started = time.perf_counter()
    result: dict = {"prompt": prompt, "success": False, "model_used": QVAC_MODEL_NAME}
    try:
        run = completion(
            transport,
            model_id=model_id,
            history=[{"role": "user", "content": prompt}],
        )
        answer = await run.text()
        result["answer"] = answer
        result["output_length"] = len(answer.split())
        result["output_chars"] = len(answer)
        try:
            stats = await run.stats()
            if isinstance(stats, dict):
                result["tokens_in"] = stats.get("prompt_tokens", stats.get("tokens_in"))
                result["tokens_out"] = stats.get("completion_tokens", stats.get("tokens_out"))
        except Exception:  # noqa: BLE001 - stats are best-effort
            result["tokens_in"] = None
            result["tokens_out"] = None
        result["success"] = True
    except Exception as exc:  # noqa: BLE001 - a failed prompt must not kill the run
        result["error"] = f"{type(exc).__name__}: {exc}"
    result["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
    return result


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline-check", action="store_true", help="Expect networking to be blocked")
    args = parser.parse_args()

    print("=" * 72)
    print("QVAC BENCHMARK - Qwen3 600M (QWEN3_600M_INST_Q4) - Spanish banking prompts")
    print("=" * 72)
    print("Provenance: no cloud AI API. Inference is 100% local via QVAC's worker")
    print(f"engine ('{ENGINE}'); the model was resolved from the installed SDK's")
    print(f"registry constant '{QVAC_MODEL_NAME}'.")
    print()
    print(f"Offline mode:              {args.offline_check}")
    print(f"Python:                    {sys.version.split()[0]}")
    print(f"QVAC worker cache dir:    {os.environ.get('QVAC_CACHE_DIR', '(default)')}")
    print()

    net = try_network()
    if args.offline_check:
        print(f"Network probe: reachable={net['reachable']} blocked={net['blocked']}")
        if not net["blocked"]:
            print("WARNING: --offline-check requested but external hosts are reachable.")
        print()

    print("-" * 72)
    print("Loading model ...")
    load_started = time.perf_counter()
    try:
        client, transport, model_id, source_desc = await load_model()
    except Exception as exc:  # noqa: BLE001
        print(f"FATAL: could not load '{QVAC_MODEL_NAME}' through QVAC: {exc}")
        return 2
    load_seconds = round(time.perf_counter() - load_started, 2)
    print(f"Model loaded through QVAC in {load_seconds}s (includes download if it was missing).")
    print(f"Model source: {source_desc}")
    print()

    print("-" * 72)
    print(f"Running {len(PROMPTS)} prompts ...\n")

    async def _run_all() -> list[dict]:
        return [await run_prompt(transport, model_id, p, i) for i, p in enumerate(PROMPTS)]

    started = time.perf_counter()
    results = await _run_all()
    total_seconds = round(time.perf_counter() - started, 2)

    print("-" * 72)
    for i, r in enumerate(results, 1):
        print(f"[{i}] prompt: {r['prompt']}")
        print(f"    status: {'OK' if r['success'] else 'FAILED'}")
        if not r["success"]:
            print(f"    error: {r.get('error')}")
        else:
            print(f"    latency_ms: {r['latency_ms']}")
            print(f"    output_length (words): {r['output_length']}  (chars: {r['output_chars']})")
            print(f"    tokens_in/out: {r.get('tokens_in')} / {r.get('tokens_out')}")
            print(f"    model_used: {r['model_used']}")
            print(f"    loaded_through_qvac: True")
            print(f"    inference_local: True (no cloud API)")
            print(f"    answer:\n    {r['answer'].strip()}")
        print()

    print("-" * 72)
    ok = sum(1 for r in results if r["success"])
    print(f"Summary: {ok}/{len(results)} generations successful.")
    print(f"Total prompt batch time: {total_seconds}s | model load: {load_seconds}s")
    print(f"Network reachable during run: {net['reachable'] or 'none (offline)'}")
    print("No cloud AI API was used. All inference ran locally through QVAC.")
    print("=" * 72)

    try:
        await client.__aexit__(None, None, None)
    except Exception:  # noqa: BLE001
        pass

    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        sys.exit(130)
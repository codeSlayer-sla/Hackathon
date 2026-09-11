"""Direct HTTP sources for a subset of QVAC registry models.

QVAC's registry-backed `load_model(model_src=<ModelConstant>)` path
downloads over Hyperswarm/Hypercore P2P (join a swarm, wait for peers
seeding that blob). In practice that P2P discovery can stall indefinitely
on a restrictive/firewalled network -- we hit exactly this from a hackathon
WiFi network: 0 bytes downloaded after 20+ minutes, reproduced both inside
Docker and directly on the host, so it isn't Docker's networking at fault.

Every model we use is, at its origin, a public Hugging Face GGUF/bin file
(see each model's `registrySource: "hf"` in `@qvac/sdk`'s catalog) -- QVAC's
own worker supports loading directly from an `https://` URL via
`downloadModelFromHttp`, which independently verifies the download against
the Hub's SHA-256 (same integrity guarantee as the P2P/registry path), so
this is not a trust downgrade. Passing that URL as `model_src` (with an
explicit `model_type`, since it can't be inferred from a plain string)
skips the P2P layer entirely.

Only models actually used by this repo's services are listed here.
`qvac_runtime.py`/`rag_engine.py` fall back to the normal registry-constant
path for any model name not present, so this is additive, not a hard
dependency on the mapping staying exhaustive.
"""

from __future__ import annotations

# name -> (direct HF URL, QVAC model_type for load_model())
DIRECT_MODEL_SOURCES: dict[str, tuple[str, str]] = {
    "LLAMA_3_2_1B_INST_Q4_0": (
        "https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF/resolve/"
        "b69aef112e9f895e6f98d7ae0949f72ff09aa401/Llama-3.2-1B-Instruct-Q4_0.gguf",
        "llm",
    ),
    "QWEN3_4B_Q4_K_M": (
        "https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/"
        "9b5c4f3506ac99d74e59ecd9aa9abb05537b7f59/Qwen3-4B-Q4_K_M.gguf",
        "llm",
    ),
    "QWEN3_8B_INST_Q4_K_M": (
        "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf",
        "llm",
    ),
    "EMBEDDINGGEMMA_300M_Q4_0": (
        "https://huggingface.co/unsloth/embeddinggemma-300m-GGUF/resolve/"
        "6661a6504c30d8304af13455cb4a5d4f5bc6011f/embeddinggemma-300m-Q4_0.gguf",
        "embeddings",
    ),
    "MEDGEMMA_4B_IT_Q4_1": (
        "https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/"
        "fa17ea2647ef236db91adfe1465a61ab6562cf2c/medgemma-4b-it-Q4_1.gguf",
        "llm",
    ),
    "VISIONPSY_NANO_460M_MULTIMODAL_Q8_0": (
        "https://huggingface.co/qvac/VisionPsy-Nano-460M-Flash-GGUFs/resolve/"
        "a24fb9cdd1119406b15ff60b06a51f8438a931c1/visionpsy-nano-460m-flash-q8_0.gguf",
        "llm",
    ),
    "MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0": (
        "https://huggingface.co/qvac/VisionPsy-Nano-460M-Flash-GGUFs/resolve/"
        "a24fb9cdd1119406b15ff60b06a51f8438a931c1/mmproj-visionpsy-nano-460m-flash-q8.gguf",
        "llm",
    ),
    "WHISPER_TINY": (
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/"
        "5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.bin",
        "whisper",
    ),
}

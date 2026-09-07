from pydantic_settings import BaseSettings, SettingsConfigDict


class NodeSettings(BaseSettings):
    """Env-driven config shared by every node. No hardcoded IPs/hostnames anywhere:
    peers find each other only through these URLs, set per-environment (docker-compose,
    a second physical machine, etc.).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    node_id: str = "node-local"
    role: str = "enterprise"  # enterprise | medium_provider | large_provider
    model_tier: str = "small"  # small | medium | large
    model_name: str = "LLAMA_3_2_1B_INST_Q4_0"
    price_per_1k_tokens: float = 0.0
    port: int = 8000

    router_url: str = "http://router:8000"
    rag_url: str = "http://rag:8000"
    peer_medium_url: str = "http://peer-medium:8000"
    peer_large_url: str = "http://peer-gpu:8000"

    qvac_cache_dir: str = "/data/qvac-models"

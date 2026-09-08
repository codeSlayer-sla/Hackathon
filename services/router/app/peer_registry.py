"""In-memory peer registry: peers self-register/heartbeat, the Router never
hardcodes which node is "the" medium or large provider.
"""

from __future__ import annotations

from datetime import datetime, timezone

from qvac_mesh_shared import ModelTier, PeerCapability

STALE_AFTER_SECONDS = 60


class PeerRegistry:
    def __init__(self) -> None:
        self._peers: dict[str, PeerCapability] = {}

    def upsert(self, capability: PeerCapability) -> None:
        self._peers[capability.node_id] = capability

    def all(self) -> list[PeerCapability]:
        return list(self._peers.values())

    def _fresh(self) -> list[PeerCapability]:
        now = datetime.now(timezone.utc)
        return [
            p
            for p in self._peers.values()
            if p.available and (now - p.last_seen).total_seconds() < STALE_AFTER_SECONDS
        ]

    def available(self, model_tier: ModelTier | None = None) -> list[PeerCapability]:
        fresh = self._fresh()
        if model_tier is None:
            return fresh
        return [p for p in fresh if p.model_tier == model_tier]

    def by_capability(self, capability: str) -> list[PeerCapability]:
        return [p for p in self._fresh() if capability in p.capabilities]


registry = PeerRegistry()

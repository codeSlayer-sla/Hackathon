from enum import Enum


class SensitivityClass(str, Enum):
    """How restricted a piece of knowledge/request is. Drives P2P delegation policy."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class ComplexityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ModelTier(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class NodeRole(str, Enum):
    ENTERPRISE = "enterprise"
    MEDIUM_PROVIDER = "medium_provider"
    LARGE_PROVIDER = "large_provider"


class ExecutionMode(str, Enum):
    LOCAL = "local"
    P2P = "p2p"


class SettlementStatus(str, Enum):
    NOT_IMPLEMENTED = "not_implemented"
    PENDING = "pending"
    SETTLED = "settled"

# Changelog

Un componente, una sección. Cada línea es `commit` + fecha + qué cambió, para
poder rastrear cuándo y en qué commit cambió cada pieza sin tener que bucear
en `git log`. Entradas más nuevas arriba de cada sección.

## RAG

- `616bda0` 2026-09-07: suite pytest para `/health` y `/search` (modo fallback keyword-search)
- `4a5ba1e` 2026-09-07: servicio RAG (FastAPI) con `POST /search` real contra QVAC (rag/RagRequest) + fallback keyword-search sobre docs demo

## Router

- `536099e` 2026-09-07: suite pytest para policy/registry/`/ask` (incluye `/ask` completo con RAG y Peer mockeados)
- `3b99a56` 2026-09-07: servicio Router: peer registry con heartbeat, policy placeholder, `POST /ask` ejecuta el flujo completo RAG->Peer->UsageEvent

## Peer (Medium/Large)

- `bbbeb62` 2026-09-07: suite pytest para `/health`, `/capabilities`, `/infer` (modo fallback stub)
- `dae32d8` 2026-09-07: servicio Peer generico (una imagen para medium y gpu) con `/capabilities`, `/health`, `/infer` real via QVAC `completion()`, heartbeat al Router

## Frontend

- `8aa56e9` 2026-09-07: chat React/Vite + panel de peers, contra Router `/ask` y `/peers`, tipado con `shared-ts/types.ts`

## Shared / Infra

- `8c3d206` 2026-09-07: suite pytest para `qvac_mesh_shared` (defaults, timestamps, roundtrip serialization)
- `dc7e2d2` 2026-09-07: docker-compose (rag, router, peer-medium, peer-gpu, frontend), .env.example, README. Validado con `docker compose config`; falta validar `up --build` con el daemon corriendo
- `ee97a05` 2026-09-07: contratos Pydantic compartidos (ExecutionPlan, PeerCapability, UsageEvent, RagResult, enums, NodeSettings)

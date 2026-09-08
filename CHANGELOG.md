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

- `428615c` 2026-09-07: pestanas Installed Base (Capturar visita / Clientes / Analytics) + Mesh Demo movido a `mesh/MeshDemoView.tsx`, con suite vitest por vista nueva
- `4216d70` 2026-09-07: suite vitest + testing-library para el chat (render + estado vacio de peers)
- `8aa56e9` 2026-09-07: chat React/Vite + panel de peers, contra Router `/ask` y `/peers`, tipado con `shared-ts/types.ts`

## Installed Base (Philips Challenge)

- `2e748e6` 2026-09-07: suite pytest -- parseo JSON defensivo, deteccion de duplicados, analytics, `/capture/turn` con Router/Peer mockeados
- `821b16f` 2026-09-07: servicio Installed Base -- captura conversacional (`/capture/turn`), extraccion via Peer real, deteccion de duplicados, SQLite con seed de las 20 filas dummy, Customer 360 (`/customers`), analytics (`/analytics`)

## Shared / Infra

- `969f42f` 2026-09-07: contratos Installed Base (ObservationStatus, ConfidenceLevel, EquipmentObservation, CaptureTurnRequest/Response, CustomerSummary, AnalyticsSummary) + espejo TS
- `6b3f3a5` 2026-09-07: README reescrito -- que es la app, componentes, arquitectura objetivo, limitaciones y como abordarlas
- `dbb444b` 2026-09-07: `scripts/run_tests.py` -- corre todos los modulos o un subconjunto via `--modules`, mismo runner para pytest y npm/vitest
- `8c3d206` 2026-09-07: suite pytest para `qvac_mesh_shared` (defaults, timestamps, roundtrip serialization)
- `dc7e2d2` 2026-09-07: docker-compose (rag, router, peer-medium, peer-gpu, frontend), .env.example, README. Validado con `docker compose config`; falta validar `up --build` con el daemon corriendo
- `ee97a05` 2026-09-07: contratos Pydantic compartidos (ExecutionPlan, PeerCapability, UsageEvent, RagResult, enums, NodeSettings)

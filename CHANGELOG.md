# Changelog

Un componente, una sección. Cada línea es `commit` + fecha + qué cambió, para
poder rastrear cuándo y en qué commit cambió cada pieza sin tener que bucear
en `git log`. Entradas más nuevas arriba de cada sección.

## RAG

- `616bda0` 2026-09-07: suite pytest para `/health` y `/search` (modo fallback keyword-search)
- `4a5ba1e` 2026-09-07: servicio RAG (FastAPI) con `POST /search` real contra QVAC (rag/RagRequest) + fallback keyword-search sobre docs demo

## Router

- `2814e11` 2026-09-08: `POST /infer` capability-routed (completion/multimodal/transcription) -- unico punto donde se decide que peer atiende cada pedido
- `536099e` 2026-09-07: suite pytest para policy/registry/`/ask` (incluye `/ask` completo con RAG y Peer mockeados)
- `3b99a56` 2026-09-07: servicio Router: peer registry con heartbeat, policy placeholder, `POST /ask` ejecuta el flujo completo RAG->Peer->UsageEvent

## Peer (Medium/Large)

- `299d35e` 2026-09-08: QvacRuntime generalizado a completion/multimodal/transcription (VisionPsy Nano, Whisper), `/transcribe`, tests con reload de env para probar los 3 kinds
- `bbbeb62` 2026-09-07: suite pytest para `/health`, `/capabilities`, `/infer` (modo fallback stub)
- `dae32d8` 2026-09-07: servicio Peer generico (una imagen para medium y gpu) con `/capabilities`, `/health`, `/infer` real via QVAC `completion()`, heartbeat al Router

## Frontend

- `13ec033` 2026-09-08: fix de 2 tests que rompieron al correr la suite completa (getAllByText en Analytics, mock de /analytics en App.test.tsx)
- `1046bb0` 2026-09-08: pestanas Fotos y Consultas (antes solo existian como API), login de tecnico compartido entre pestanas via LoginGate.tsx, Analytics ahora muestra stale_customers/refresh_opportunities
- `c7454a2` 2026-09-08: login por PIN en CaptureView (requerido ahora por `/capture/turn`)
- `428615c` 2026-09-07: pestanas Installed Base (Capturar visita / Clientes / Analytics) + Mesh Demo movido a `mesh/MeshDemoView.tsx`, con suite vitest por vista nueva
- `4216d70` 2026-09-07: suite vitest + testing-library para el chat (render + estado vacio de peers)
- `8aa56e9` 2026-09-07: chat React/Vite + panel de peers, contra Router `/ask` y `/peers`, tipado con `shared-ts/types.ts`

## Installed Base (Philips Challenge)

- `0342b14` 2026-09-08: `compute_confidence` ahora factoriza la antiguedad de la observacion (se recalcula en cada lectura, no queda congelado al insertar)
- `7d2f647` 2026-09-08: auth de tecnico por PIN, captura por voz, captura por foto con cola de revision, confidence combinado, freshness/oportunidades, `/query` en lenguaje natural, idempotencia via `client_event_id` (cierra los 5 stretch goals + arquitectura multi-nodo)
- `2e748e6` 2026-09-07: suite pytest -- parseo JSON defensivo, deteccion de duplicados, analytics, `/capture/turn` con Router/Peer mockeados
- `821b16f` 2026-09-07: servicio Installed Base -- captura conversacional (`/capture/turn`), extraccion via Peer real, deteccion de duplicados, SQLite con seed de las 20 filas dummy, Customer 360 (`/customers`), analytics (`/analytics`)

## Shared / Infra

- `ab35a24` 2026-09-07: README documenta el reto Philips (Installed Base), componentes, diagrama y puertos actualizados
- `bdc7ac8` 2026-09-08: `peer-vision`/`peer-voice` en docker-compose + volumen `media-data` compartido + `AUTH_PEPPER`/`INSTALLED_BASE_MEDIA_DIR` en `.env.example`
- `ef1cc01` 2026-09-07: installed-base en docker-compose (puerto 8005, volumen propio) + `.env.example` + `scripts/run_tests.py`
- `42ff11f` 2026-09-08: contratos de capability-routing (PeerCapability.capabilities, RouterInferRequest/Result, TranscribeRequest/Result), image_path multimodal, client_event_id offline-sync, freshness/opportunities en AnalyticsSummary
- `969f42f` 2026-09-07: contratos Installed Base (ObservationStatus, ConfidenceLevel, EquipmentObservation, CaptureTurnRequest/Response, CustomerSummary, AnalyticsSummary) + espejo TS
- `1c417b2` 2026-09-08: ventana oficial de 48h confirmada (9 sep 08:00 -> 11 sep 08:00) -- todo el trabajo previo a esa fecha reclasificado como preexistente, corte explicito y verificable
- `414a32a` 2026-09-08: declaracion obligatoria de base preexistente (hashes/fechas exactas: mesh generico antes del reto vs. trabajo dentro de la ventana de 48h) -- requisito de la hackathon, omitirlo descalifica
- `33075f6` 2026-09-08: README reestructurado -- "como funciona" (con ejemplos curl) y "como lo monto" al frente, historial/limitaciones movidos al final
- `cef304a` 2026-09-08: README documenta capability-routing, auth de tecnico, arquitectura multi-nodo/VPS y 5 limitaciones nuevas
- `6b3f3a5` 2026-09-07: README reescrito -- que es la app, componentes, arquitectura objetivo, limitaciones y como abordarlas
- `dbb444b` 2026-09-07: `scripts/run_tests.py` -- corre todos los modulos o un subconjunto via `--modules`, mismo runner para pytest y npm/vitest
- `8c3d206` 2026-09-07: suite pytest para `qvac_mesh_shared` (defaults, timestamps, roundtrip serialization)
- `dc7e2d2` 2026-09-07: docker-compose (rag, router, peer-medium, peer-gpu, frontend), .env.example, README. Validado con `docker compose config`; falta validar `up --build` con el daemon corriendo
- `ee97a05` 2026-09-07: contratos Pydantic compartidos (ExecutionPlan, PeerCapability, UsageEvent, RagResult, enums, NodeSettings)

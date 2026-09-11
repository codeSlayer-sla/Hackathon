# Changelog

Un componente, una sección. Cada línea es `commit` + fecha + qué cambió, para
poder rastrear cuándo y en qué commit cambió cada pieza sin tener que bucear
en `git log`. Entradas más nuevas arriba de cada sección.

La app móvil de técnicos (`apps/technician-app`, Expo/React Native) tiene su
propio changelog en esa carpeta -- stack y ciclo de vida distintos al resto
de este monorepo.

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

- `c3d60b3` 2026-09-11: dashboard rediseñado como panel de solo lectura -- se saca el formulario de registrar técnico (se provisiona por otra vía, esta UI es únicamente para observar el mesh), sistema de diseño navy/Plus Jakarta Sans, `StatTile` compartido con anuncio para lectores de pantalla, badge de "Técnicos" ahora muestra el conteo real de delegaciones en vez de un flag booleano
- `24d7bee` 2026-09-09: pestana "Tecnicos" ahora es el dashboard de operacion completo que se pidio -- cuantos registros subio cada tecnico, badge "nodo principal" cuando el tecnico esta usando `/extract` (proceso en el nodo, no local), y tabla tecnico x pais reusando el `/analytics` que ya llamaba la pestana Analytics
- `b6cd4dd` 2026-09-09: pestana "Tecnicos" -- registrar (nombre + PIN, `POST /technicians`) y ver ultima actividad de cada uno (verde/ambar/gris por antiguedad, "Nunca conectado" si nunca llego); registrar no requiere ningun paso de "sincronizar" aparte, el `/auth/roster` que ya existia levanta la lista actualizada solo. Tambien primer sistema de diseno compartido (`theme.ts`) -- antes cada vista tenia sus propios estilos inline sueltos; aplicado al shell de la app y a la vista nueva, el resto de las vistas queda pendiente
- `13ec033` 2026-09-08: fix de 2 tests que rompieron al correr la suite completa (getAllByText en Analytics, mock de /analytics en App.test.tsx)
- `1046bb0` 2026-09-08: pestanas Fotos y Consultas (antes solo existian como API), login de tecnico compartido entre pestanas via LoginGate.tsx, Analytics ahora muestra stale_customers/refresh_opportunities
- `c7454a2` 2026-09-08: login por PIN en CaptureView (requerido ahora por `/capture/turn`)
- `428615c` 2026-09-07: pestanas Installed Base (Capturar visita / Clientes / Analytics) + Mesh Demo movido a `mesh/MeshDemoView.tsx`, con suite vitest por vista nueva
- `4216d70` 2026-09-07: suite vitest + testing-library para el chat (render + estado vacio de peers)
- `8aa56e9` 2026-09-07: chat React/Vite + panel de peers, contra Router `/ask` y `/peers`, tipado con `shared-ts/types.ts`

## Installed Base (Philips Challenge)

- `9581f74` 2026-09-11: `technicians.remote_extraction_count` -- se incrementa en cada `POST /extract` exitoso, en vez de solo un `last_extract_at` (timestamp) que decía "alguna vez pasó" pero no cuánto. Migración in-place vía `ALTER TABLE` guardado. `SEED_DEMO_DATA` (default true) permite arrancar el store vacío para una demo contra un cliente real, sin las 20 filas dummy
- `24d7bee` 2026-09-09: `AnalyticsSummary` gana `by_technician`/`by_technician_country` (agrupado por `observer`, que ya es confiable porque `/capture/turn` y `/sync` siempre lo pisan con el nombre del tecnico autenticado); `technicians` gana `last_extract_at`, actualizado desde `/extract` -- responde "ya envio procesamiento al nodo principal" en vez de solo "esta online". `Store.list_technicians_with_activity()` calcula `observation_count` con un solo join en vez de que cada consumidor arme su propio conteo
- `46a67c5` 2026-09-09: tecnicos movidos de un dict hardcodeado en `auth.py` a una tabla SQLite real -- no habia forma de registrar uno nuevo sin editar codigo y redesplegar. `POST /technicians` (nombre+PIN) + `GET /technicians` (nunca expone PIN/hash) para el admin del frontend; `GET /auth/roster` no necesito ningun cambio, ya leia de "la lista de tecnicos que exista" y ahora esa lista es persistente y mutable. `last_seen_at` se actualiza en cada request autenticado (login/captura/sync/extract/roster) via `get_current_technician` -- visibilidad real de que apps estan hablando con este nodo, no solo un roster estatico
- `96d4e14` 2026-09-09: `POST /extract` -- contraparte sin estado de `/capture/turn` para la app movil; cuando el telefono esta online usa el modelo que el Router tenga registrado para "completion" (potencialmente mas grande que el del telefono) en vez de extraer localmente, sin efectos de sesion/guardado ya que la app maneja todo eso por su cuenta
- `4bb74e3` 2026-09-09: `GET /auth/roster` -- pepper + PIN hashes para que la app movil pueda validar el login offline sin PINs hardcodeados; requiere token (misma dependencia que el resto de endpoints de escritura), asi el pepper nunca queda embebido en el build de la app
- `5bf690b` 2026-09-09: `POST /sync` -- acepta en batch la cola offline de la app movil, idempotente por (tecnico, local_id) via el mismo cache de `processed_events`
- `0342b14` 2026-09-08: `compute_confidence` ahora factoriza la antiguedad de la observacion (se recalcula en cada lectura, no queda congelado al insertar)
- `7d2f647` 2026-09-08: auth de tecnico por PIN, captura por voz, captura por foto con cola de revision, confidence combinado, freshness/oportunidades, `/query` en lenguaje natural, idempotencia via `client_event_id` (cierra los 5 stretch goals + arquitectura multi-nodo)
- `2e748e6` 2026-09-07: suite pytest -- parseo JSON defensivo, deteccion de duplicados, analytics, `/capture/turn` con Router/Peer mockeados
- `821b16f` 2026-09-07: servicio Installed Base -- captura conversacional (`/capture/turn`), extraccion via Peer real, deteccion de duplicados, SQLite con seed de las 20 filas dummy, Customer 360 (`/customers`), analytics (`/analytics`)

## Shared / Infra

- `df140c4` 2026-09-11: README -- corrige el commit de corte pre-hackathon declarado (era `0925176`, quedó desactualizado porque siguió habiendo preparación varias horas más ese mismo día); el corte real verificable con `git log` es `5d1308c` (2026-09-08 16:34)
- `4b27965` 2026-09-11: fix del worker de QVAC en `peer`/`rag` -- npm sube `bare-runtime-<platform>` al `node_modules` de nivel superior (nada más necesita otra versión), pero `Client()` lo busca anidado bajo `@qvac/sdk/node_modules/`, tirando `WorkerNotFoundError` con el binario ya presente un nivel arriba; además el binario no traía el bit de ejecución. `scripts/fix_qvac_worker.sh` corrige ambas cosas después de `install-worker`. También: la descarga por P2P/Hyperswarm del registry de QVAC se puede colgar indefinidamente en una red restringida (probado: 0 bytes en 20+ min, dentro y fuera de Docker) -- como el origen real de cada modelo es un GGUF público en Hugging Face, `qvac_model_sources.py` mapea los modelos conocidos a su URL directa y el runtime la prefiere sobre el registry P2P
- `b77aa46` 2026-09-09: `peer-medium`/`peer-gpu` pasan de `LLAMA_3_2_1B_INST_Q4_0` (mismo modelo que el telefono) a `MEDGEMMA_4B_IT_Q4_1` -- para que el nuevo `/extract` de la app movil (prefiere el nodo principal cuando esta online) realmente entregue un modelo mejor, no el mismo. MedGemma elegido por dominio (equipos medicos), verificado como constante real en el SDK instalado; riesgo conocido sin verificar en hardware real: esta afinado para QA clinico, no necesariamente para JSON estricto -- `QWEN3_4B_INST_Q4_K_M` (tambien verificado) es el fallback de una linea
- `3e68ebc` 2026-09-09: README raiz actualizado -- la referencia a `technician-app` seguia describiendo el smoke test original, varios commits despues de haber sido reemplazado por el flujo real
- `867a6e2` 2026-09-09: `run_tests.py` -- `technician-app` corria `npm test`, que falla ahora mismo (no existe ese script desde que se reemplazo el smoke test); corre `npm run typecheck` en su lugar
- `30c7a72` 2026-09-08: `apps/technician-app` cableado en `scripts/run_tests.py` + README/CHANGELOG actualizados para reflejar la app movil real (Expo/React Native)
- `06689b0` 2026-09-08: split de docker-compose en 3 laptops (node-a/b/c) para P2P real, docs/multi-host-demo.md
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

# Enterprise AI Mesh

MVP de hackathon construido sobre [QVAC](https://github.com/tetherto/qvac) (SDK
local-first de Tether). Tesis: RAG empresarial local, un AI Router que decide
qué modelo y en qué nodo ejecutar una solicitud, delegated inference P2P entre
peers QVAC, y un usage meter con settlement opcional en USDt/WDK.

Este repo es el **entorno genérico**: contratos de API, Dockerfiles y los 5
servicios del proyecto ya arrancando y hablando entre sí, con un flujo real
(no mockeado) de "pregunta -> RAG local -> Router -> inferencia local/P2P ->
respuesta + costo". Las reglas finas (clasificación de complejidad,
privacidad, pricing/settlement real) son *mission-dependent* y se afinan
cuando se asignen las tareas de la hackathon — ver `CHANGELOG.md` por
componente y la sección "Qué falta" más abajo.

## Arquitectura

```
Frontend (chat) --POST /ask--> Router --POST /search--> RAG
                                  |
                                  +--POST /infer--> Peer (medium | gpu)
                                                        |
                                                    QVAC local (completion real)
```

- **RAG** (`services/rag`): ingesta unos documentos demo e indexa con QVAC
  (`rag()` / RagRequest de `tetherto-qvac-sdk`). `POST /search` devuelve
  contexto + fuentes + sensibilidad.
- **Router** (`services/router`): registro de peers (auto-anuncio, sin IPs
  hardcodeadas), política de decisión simple (`app/policy.py`), y
  `POST /ask` que ejecuta el flujo completo RAG -> Peer -> `UsageEvent`.
- **Peer** (`services/peer`): una sola imagen, usada dos veces
  (`peer-medium`, `peer-gpu`) diferenciada solo por env vars. Corre un
  modelo QVAC real (`completion()`) y expone `/capabilities`, `/health`,
  `/infer`.
- **Frontend** (`services/frontend`): chat + panel de peers en React/Vite,
  contra el contrato compartido en `shared-ts/types.ts`.
- **Shared** (`shared/py/qvac_mesh_shared`): los contratos Pydantic
  (`ExecutionPlan`, `PeerCapability`, `UsageEvent`, etc.) que usan RAG,
  Router y Peer. Es un paquete pip instalable (`pip install -e shared/py`).

## Cómo levantar el entorno

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Router: http://localhost:8001 (docs en `/docs`)
- RAG: http://localhost:8002
- Peer medium: http://localhost:8003
- Peer GPU: http://localhost:8004

La primera vez, `peer-medium` y `peer-gpu` descargan un modelo pequeño real
(`LLAMA_3_2_1B_INST_Q4_0`, ~770MB) y RAG descarga un modelo de embeddings
(`EMBEDDINGGEMMA_300M_Q4_0`, ~280MB) vía QVAC. Mientras se descarga, cada
servicio sigue funcionando en modo fallback (RAG hace keyword search sobre
los docs demo, el Peer responde con una respuesta "stub" que dice que el
modelo no está listo) — así nunca se cae la demo por falta de red/tiempo.

Sin Docker, cada servicio corre igual con un venv (`pip install -e shared/py
-r services/<x>/requirements.txt && uvicorn app.main:app`) más `npm install
&& npm run dev` en `services/frontend`.

### Caveat verificado en este entorno (Windows)

`tetherto-qvac-sdk`'s `install-worker` no detectó `npm` corriendo dentro de
Git Bash/PowerShell en esta máquina Windows (aunque `npm`/`node` sí están
instalados y en PATH) — es un problema de resolución de comandos del propio
instalador del SDK en Windows nativo, no de este repo. Dentro del contenedor
Docker (Debian + Node.js vía NodeSource) este problema no debería
reproducirse, pero si alguien lo ve: instalar `@qvac/sdk` globalmente
(`npm install -g @qvac/sdk@<version>`) y apuntar `QVAC_SDK_DIR`/
`QVAC_WORKER_PATH` a esa instalación es el workaround documentado por el
propio SDK.

## Variables de entorno

Ver `.env.example`. Regla de oro: ningún servicio tiene una IP/hostname
hardcodeado — todo peer se descubre vía `ROUTER_URL`/`RAG_URL`/registro de
capacidades, así que mover un peer a otra laptop es solo cambiar esas URLs.

## Por dónde empieza cada quien (cuando lleguen las tareas)

| Workstream | Carpeta | Punto de partida |
|---|---|---|
| 1. RAG | `services/rag/app/rag_engine.py` | reemplazar `DEMO_DOCUMENTS` por ingesta real, afinar chunking/sensibilidad |
| 2. Router | `services/router/app/policy.py` | reemplazar la heurística de `classify_complexity`/`decide_plan` por las reglas reales |
| 3. Medium Peer | `services/peer` + env vars de `peer-medium` en `docker-compose.yml` | nada de código nuevo si el modelo alcanza; si no, ajustar `qvac_runtime.py` |
| 4. GPU/Large Peer | `services/peer` + env vars de `peer-gpu` | cambiar `MODEL_NAME` a un modelo grande real + config de GPU en el Dockerfile/compose |
| 5. Frontend/Economy | `services/frontend/src` | pulir UI, sumar wallet/settlement real (hoy `UsageEvent.settlement_status` es `not_implemented`) |

## Qué falta (mission-dependent, no bloquea el arranque)

- Pipeline de ingesta RAG a medida (hoy son 4 docs demo hardcodeados).
- Clasificación real de complejidad/privacidad (hoy es un heurístico de
  palabras clave/longitud).
- P2P real entre máquinas físicas distintas (hoy los 2 peers son contenedores
  en la misma máquina, tal como recomienda el documento del proyecto para
  desarrollo).
- Settlement USDt/WDK real.

## Changelog

Cada cambio a un componente se registra en `CHANGELOG.md`, en la sección de
ese componente, con el hash del commit que lo introdujo. Workflow: hacé el
commit del cambio, tomá su hash corto (`git rev-parse --short HEAD`), y
agregá una línea a la sección correspondiente en un commit chico de
`docs: changelog <hash>`.

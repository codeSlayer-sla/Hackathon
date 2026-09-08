# Enterprise AI Mesh

## Qué es esta app

**Enterprise AI Mesh** es un MVP de hackathon construido sobre
[QVAC](https://github.com/tetherto/qvac), el SDK local-first de Tether para
correr IA en el dispositivo (sin cloud, sin API keys).

La tesis del proyecto: *"Local intelligence. Distributed compute. Autonomous
settlement."* En una empresa no solo importa qué modelo responde una
pregunta, sino **dónde** se ejecuta, **qué información** usa, **cuántos
recursos** consume y **cuánto cuesta** esa capacidad. La propuesta combina
cuatro piezas:

1. **RAG local**: el conocimiento empresarial (documentación, procedimientos,
   troubleshooting) vive en un vector store local, nunca en un servicio
   cloud de terceros.
2. **AI Router**: decide qué modelo (Small/Medium/Large) y en qué nodo
   ejecutar cada solicitud, según complejidad, sensibilidad de la
   información y capacidad disponible.
3. **P2P delegated inference**: si el nodo de entrada no tiene capacidad
   suficiente, la inferencia se delega a otro nodo QVAC autorizado de la
   red — nunca a un proveedor cloud externo.
4. **Usage metering**: cada inferencia registra nodo, modelo, duración,
   tokens y costo, representable a futuro como settlement programático en
   USDt/WDK.

Problema que resuelve: dependencia de APIs cloud para tareas que no la
necesitan, riesgo de exponer información sensible a terceros, uso de modelos
grandes para preguntas triviales, infraestructura propia subutilizada, y
poca visibilidad de cuánto cuesta realmente la IA en la organización.

## Estado de este repo

Esto **no es el proyecto completo** de la hackathon — es el entorno
genérico: todo lo que no depende de qué tarea específica le toque a cada
persona cuando se repartan los 5 workstreams (RAG, Router, Medium Peer,
GPU/Large Peer, Frontend+Economy). Concretamente, ya funciona un flujo real
de punta a punta (no mockeado):

```
pregunta -> RAG local -> Router decide -> inferencia local (Peer) -> respuesta + fuentes + costo
```

Las reglas finas (clasificación de complejidad real, políticas de privacidad
sofisticadas, pricing/settlement real) quedan como placeholders simples a
propósito — son *mission-dependent* y se afinan cuando se asignen las
tareas. Ver "Limitaciones" más abajo y `CHANGELOG.md` para el historial de
cada componente.

## Primer reto: Customer Installed Base Intelligence (Philips)

Ya llegó la primera misión concreta de la hackathon. Philips pide un
prototipo que convierta lo que un colaborador de campo observa en un
hospital ("dos resonadores y un tomógrafo, uno de los MR parece de unos
ocho años") en datos estructurados y confiables sobre la base instalada de
equipos — con captura tan simple como una conversación, y con **requisito
obligatorio y descalificante**: la inferencia debe correr en el dispositivo
o delegada P2P vía QVAC, nunca en una API cloud.

Esto es exactamente lo que el Enterprise AI Mesh ya garantiza por
construcción: cualquier consumidor que solo le hable al Router/Peer hereda
"inferencia local/P2P, nunca cloud" gratis. `services/installed-base` es
ese primer consumidor real — un servicio de dominio nuevo que usa un Peer
para la extracción con IA, sin tocar RAG/Router/Peer (que siguen siendo
genéricos, como se diseñaron).

Qué hace hoy (cubre el "Minimum Viable Prototype" del brief):

- `POST /capture/turn`: recibe una observación en lenguaje natural, la
  manda a un Peer real vía QVAC para extraer cliente/ciudad/país/equipo
  (modalidad, cantidad, marca, modelo, antigüedad), pregunta lo que falte
  en un follow-up, y guarda cuando está completa.
- Detecta posibles duplicados (mismo cliente normalizado + misma modalidad)
  al guardar.
- Persiste en SQLite con estado (`confirmed | reported | estimated |
  unknown`) y confianza (`high | medium | low`) por observación.
- `GET /customers` / `GET /customers/{id}`: vista Customer 360.
- `GET /analytics`: agregación entre clientes (por modalidad, país, status,
  edad promedio, clientes con equipo viejo, clientes con info incompleta).
- Arranca con las 20 observaciones dummy del Excel del reto ya cargadas
  (`app/seed_data.py`), así el dashboard nunca arranca vacío.
- Frontend: pestañas "Capturar visita", "Clientes" y "Analytics" en
  `services/frontend/src/installedBase/`.

Qué queda como stretch goal del propio brief, no construido en esta pasada:
captura por voz, captura asistida por foto de etiquetas, confidence scoring
combinando completitud + antigüedad + confirmaciones independientes,
alertas de información no verificada recientemente, consultas en lenguaje
natural libres sobre el dataset, e identificación automática de
oportunidades de renovación.

Nota técnica: la extracción usa prompting + parseo defensivo de JSON, no
decodificación forzada por schema. `completion()` del SDK acepta un
parámetro `response_format` que podría forzar JSON válido — su forma exacta
no se verificó a tiempo contra la versión instalada, así que queda como
mejora documentada en `services/installed-base/app/extraction.py`.

## Componentes

```
Frontend --POST /ask--> Router --POST /search--> RAG
   |                       |
   |                       +--POST /infer--> Peer (medium | gpu)
   |                                             |
   |                                         QVAC local (completion real)
   |
   +--POST /capture/turn--> Installed Base --GET /peers--> Router
                                  |                            |
                                  +--------POST /infer----------+ (mismo Peer)
                                  |
                              SQLite (observaciones)
```

| Componente | Carpeta | Qué hace hoy |
|---|---|---|
| **RAG** | `services/rag` | Ingesta 4 documentos demo y los indexa con QVAC real (`rag()`/`RagRequest` de `tetherto-qvac-sdk`). `POST /search` devuelve contexto + fuentes + sensibilidad. Si el modelo de embeddings no está disponible, cae a búsqueda por keywords sobre los mismos docs — nunca se cae la demo. |
| **Router** | `services/router` | Registro de peers por auto-anuncio/heartbeat (sin IPs hardcodeadas), una política de decisión simple (`app/policy.py`), y `POST /ask` que ejecuta el flujo completo: RAG → elegir peer → inferencia → `UsageEvent`. |
| **Peer** | `services/peer` | Una sola imagen usada dos veces (`peer-medium`, `peer-gpu`), diferenciada solo por variables de entorno. Corre un modelo QVAC real (`completion()`) y expone `/capabilities`, `/health`, `/infer`. Si el modelo no cargó, responde un stub explícito en vez de fallar. |
| **Installed Base** | `services/installed-base` | El reto de Philips (ver arriba): captura conversacional, extracción con IA vía un Peer, detección de duplicados, SQLite, Customer 360 y analytics. |
| **Frontend** | `services/frontend` | React/Vite con pestañas: Capturar visita / Clientes / Analytics (Installed Base) + Mesh Demo (el chat genérico original). Tipado contra `shared-ts/types.ts`. |
| **Shared** | `shared/py/qvac_mesh_shared` | Contratos Pydantic (`ExecutionPlan`, `PeerCapability`, `UsageEvent`, `RagResult`, `EquipmentObservation`, etc.) que usan todos los servicios. Paquete pip instalable (`pip install -e shared/py`). Espejo en TypeScript en `shared-ts/types.ts`. |

## Arquitectura a la que apuntamos

Lo que hoy corre es un **walking skeleton**: prueba que el concepto
"pregunta → conocimiento local → decisión → inferencia local/P2P →
resultado medido" funciona de verdad, con una sola instancia real de cada
pieza. La arquitectura completa del proyecto (que se termina de construir
cuando se asignen los 5 workstreams) es:

```
USUARIO -> ASSISTANT -> AI ROUTER (local)
                            |
                            +-> RAG LOCAL (conocimiento empresarial)
                            |
                            +-> clasifica privacidad + complejidad
                            |
                            +-> Small/Medium/Large
                                   |
                    capacidad suficiente? --NO--> P2P a otro nodo QVAC autorizado
                                   |
                                  SI
                                   |
                              inferencia local
                                   |
                              USAGE METER -> dashboard -> settlement USDt/WDK
```

Diferencias clave entre el walking skeleton actual y esa meta:

- **Hoy**: 1 Peer "medium" y 1 Peer "gpu" son contenedores en la misma
  máquina (la topología recomendada por el documento original del proyecto
  para desarrollo/demo). **Meta**: peers en máquinas físicas distintas,
  demostrando descentralización real, no solo lógica.
- **Hoy**: el Router usa una heurística de palabras clave/longitud para
  clasificar complejidad, y siempre trata `RESTRICTED` como local-only.
  **Meta**: un clasificador real de complejidad + una matriz de políticas de
  privacidad completa (public/internal/confidential/restricted ×
  local/trusted-peer/peer-permitido).
- **Hoy**: `UsageEvent.settlement_status` es siempre `not_implemented`.
  **Meta**: settlement programático real vía USDt/WDK cuando un nodo
  consume capacidad de otro.
- **Hoy**: RAG indexa 4 documentos hardcodeados. **Meta**: pipeline de
  ingesta real sobre documentación de infraestructura, aplicaciones,
  tickets y procedimientos de la empresa.

## Limitaciones actuales y cómo abordarlas luego

**1. QVAC no tiene una primitiva de "delegated inference" lista para usar.**
Su P2P real (Hyperswarm/Hyperdrive + blind relays) sirve para *descargar
modelos* entre peers, no para enrutar cómputo de inferencia. La "red P2P" de
este proyecto es una capa de aplicación construida encima de QVAC (Router
llamando por HTTP normal al `/infer` de un Peer), no algo que QVAC resuelva
solo.
→ *Cómo abordarla*: es una decisión de diseño ya tomada y funcionando, no un
bug — documentarla así evita que alguien pierda tiempo buscando una API de
QVAC que no existe. Si más adelante se quiere aprovechar el P2P nativo de
QVAC, sería para *distribuir los modelos* (que cada peer no tenga que
descargar el mismo GGUF por su cuenta), no para el ruteo de inferencia en sí.

**2. Un solo Peer real, el segundo es la misma imagen duplicada.**
`peer-gpu` corre hoy el mismo modelo chico que `peer-medium` (para no forzar
una descarga grande en el baseline). No hay lógica real de selección entre
múltiples peers del mismo tier.
→ *Cómo abordarla*: cuando se asigne el workstream de GPU/Large, cambiar
`MODEL_NAME` en `docker-compose.yml` a un modelo grande real y agregar la
config de GPU (device mapping) al Dockerfile/compose de ese peer. El código
de `services/peer` no necesita cambiar — es genérico por diseño.

**3. Clasificación de complejidad/privacidad es un heurístico simple.**
`classify_complexity` en `services/router/app/policy.py` mira longitud y
palabras clave, no el contenido real de la solicitud.
→ *Cómo abordarla*: reemplazar esa función por un clasificador real (puede
ser otro modelo QVAC chico corriendo en el propio Router, o reglas más
finas) cuando se conozcan los casos de uso reales de la hackathon. El
contrato (`ExecutionPlan`) no cambia, así que Frontend/Peers no se enteran.

**4. Sin P2P real entre máquinas físicas.**
Los 2 peers son contenedores en un solo host.
→ *Cómo abordarla*: mover un peer a otra laptop es, por diseño, solo cambiar
`ROUTER_URL`/`PEER_*_URL` en su `.env` (ningún IP está hardcodeado en
código) y correr `services/peer` ahí directamente o con Docker. No requiere
tocar código.

**5. Sin settlement económico real.**
`UsageEvent.settlement_status` queda en `"not_implemented"`.
→ *Cómo abordarla*: es intencional — el documento del proyecto ya aclara que
el settlement es una capa secundaria de contabilidad, no debe convertirse en
el centro del MVP. Cuando se aborde, conectar ese campo a WDK/USDt es un
cambio acotado al Workstream 5 (Frontend/Economy) + un evento que el Router
ya emite.

**6. RAG con documentos demo, no la base de conocimiento real.**
→ *Cómo abordarla*: reemplazar `DEMO_DOCUMENTS` en
`services/rag/app/demo_docs.py` por un pipeline de ingesta real (chunking,
más de un workspace, filtros de sensibilidad por documento) es trabajo
acotado al Workstream 1 — la interfaz `POST /search` no cambia.

**7. Verificación de `docker compose up --build` pendiente.**
Se validó cada servicio por separado (tests unitarios, `docker compose
config`) pero no se corrió el build completo con el daemon de Docker en
esta sesión (Docker Desktop tuvo problemas en la máquina de desarrollo).
→ *Cómo abordarla*: correr `docker compose up --build` la primera vez que
alguien tenga Docker Desktop sano; si algo falla en el build (típicamente la
instalación del worker de QVAC), ver el caveat de Windows/npm más abajo.

**8. Caveat de Windows: `install-worker` no detecta `npm`.**
En esta máquina, `tetherto-qvac-sdk`'s `install-worker` no encontró `npm`
corriendo desde Git Bash/PowerShell (aunque `npm`/`node` sí están en PATH) —
un problema de resolución de comandos del propio instalador del SDK en
Windows nativo, no de este repo. Dentro del contenedor Docker (Debian +
Node.js vía NodeSource) no debería reproducirse.
→ *Cómo abordarla si aparece*: instalar `@qvac/sdk` globalmente
(`npm install -g @qvac/sdk@<version>`) y apuntar `QVAC_SDK_DIR`/
`QVAC_WORKER_PATH` a esa instalación (workaround documentado por el propio
SDK).

## Cómo levantar el entorno

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Router: http://localhost:8001 (docs en `/docs`)
- RAG: http://localhost:8002
- Peer medium: http://localhost:8003
- Peer GPU: http://localhost:8004
- Installed Base: http://localhost:8005 (docs en `/docs`)

La primera vez, `peer-medium` y `peer-gpu` descargan un modelo pequeño real
(`LLAMA_3_2_1B_INST_Q4_0`, ~770MB) y RAG descarga un modelo de embeddings
(`EMBEDDINGGEMMA_300M_Q4_0`, ~280MB) vía QVAC. Mientras se descarga, cada
servicio sigue funcionando en modo fallback (ver "Limitaciones") — así nunca
se cae la demo por falta de red/tiempo.

Sin Docker, cada servicio corre igual con un venv (`pip install -e shared/py
-r services/<x>/requirements.txt && uvicorn app.main:app`) más `npm install
&& npm run dev` en `services/frontend`.

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

## Tests

Cada componente tiene su propia suite (pytest para los servicios Python,
vitest para el frontend) y un runner en `scripts/run_tests.py` que corre
todas o un subconjunto:

```bash
# setup (una vez por venv)
pip install -e shared/py -r requirements-test.txt \
    -r services/rag/requirements.txt \
    -r services/router/requirements.txt \
    -r services/peer/requirements.txt \
    -r services/installed-base/requirements.txt
cd services/frontend && npm install && cd ../..

# correr todo
python scripts/run_tests.py

# correr solo algunos modulos
python scripts/run_tests.py --modules rag router
python scripts/run_tests.py --modules frontend

# ver los nombres de modulo disponibles
python scripts/run_tests.py --list
```

Módulos: `shared`, `rag`, `router`, `peer`, `installed-base`, `frontend`. Los tests de RAG/Peer
corren contra el modo fallback (sin worker/modelo QVAC real) a propósito,
para que la suite no dependa de descargar modelos ni de tener Docker/red
disponible; el `/ask` de punta a punta contra RAG y Peer reales se mockea en
`services/router/tests/test_main.py` y se valida de verdad manualmente con
`docker compose up`.

## Changelog

Cada cambio a un componente se registra en `CHANGELOG.md`, en la sección de
ese componente, con el hash del commit que lo introdujo. Workflow: hacé el
commit del cambio, tomá su hash corto (`git rev-parse --short HEAD`), y
agregá una línea a la sección correspondiente en un commit chico de
`docs: changelog <hash>`.

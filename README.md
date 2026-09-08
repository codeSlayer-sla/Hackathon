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

Qué hace hoy (cubre el "Minimum Viable Prototype" del brief **y** los 5
stretch goals que habíamos dejado pendientes):

- `POST /capture/turn` (texto) y `POST /capture/turn/voice` (audio): reciben
  una observación, la mandan al Router para extraer cliente/ciudad/país/
  equipo (modalidad, cantidad, marca, modelo, antigüedad), preguntan lo que
  falte en un follow-up, y guardan cuando está completa. Ambas requieren un
  técnico autenticado (ver Auth abajo).
- `POST /photos` + cola de revisión: el técnico sube una foto y sigue
  trabajando de inmediato (no espera); un loop en background la manda al
  peer de visión, y el técnico valida sí/no después en `GET /photos` +
  `POST /photos/{id}/validate` — foto y etiqueta final quedan guardadas
  para siempre (dataset de reentrenamiento futuro).
- Detecta posibles duplicados (mismo cliente normalizado + misma modalidad)
  al guardar, y calcula un **confidence combinado** (completitud de campos +
  cantidad de confirmaciones independientes), no solo el valor crudo que
  devuelve el modelo.
- `GET /analytics` incluye alertas de **frescura** (clientes sin
  observaciones nuevas hace más de 90 días) y **oportunidades de
  renovación** (clientes con equipo viejo, con la razón explicada).
- `POST /query`: preguntas en lenguaje natural ("clientes en Panamá con MR")
  se traducen a un filtro estructurado (vía el mismo Router) y se aplican
  en Python contra el dataset — nunca se le pide a un LLM que genere SQL.
- Persiste en SQLite con estado (`confirmed | reported | estimated |
  unknown`) y confianza (`high | medium | low`) por observación.
- `GET /customers` / `GET /customers/{id}`: vista Customer 360.
- Arranca con las 20 observaciones dummy del Excel del reto ya cargadas
  (`app/seed_data.py`), así el dashboard nunca arranca vacío.
- Frontend web (`services/frontend/src/installedBase/`): pestañas
  "Capturar visita" (con login por PIN), "Clientes" y "Analytics" — sirve
  como demo/referencia mientras se construye la app nativa real.

Nota técnica: la extracción/identificación sigue siendo prompting + parseo
defensivo de JSON, no decodificación forzada por schema (`response_format`
de `completion()` queda como mejora futura, no verificada a tiempo).

## Arquitectura multi-nodo: técnicos como nodos, app nativa aparte

La visión real del producto: cada técnico tiene una app nativa (React
Native/Flutter — **se construye en otro workstream, no en este repo**) que
funciona como un nodo de la mesh. Este repo deja listo el backend y el
contrato REST para que esa app se integre:

- **El Router decide el modelo, siempre.** Ningún servicio de dominio
  (`installed-base`) descubre o llama a un Peer directamente — todo pasa
  por `POST {ROUTER_URL}/infer {capability: "completion"|"multimodal"|
  "transcription", ...}`. El Router elige un peer que tenga esa capacidad
  (`PeerCapability.capabilities`) y lo llama. Esto es cierto para texto,
  fotos y audio por igual.
- **Auth de técnico por PIN**: `POST /auth/technician {pin}` devuelve un
  token; las rutas que crean observaciones (`/capture/turn`,
  `/capture/turn/voice`, `/photos`, `/photos/{id}/validate`) lo exigen vía
  `Authorization: Bearer <token>`, y el campo `observer` de cada
  observación sale del token, nunca de algo que el cliente pueda falsear.
  **Es intencionalmente el mínimo viable**: PIN con sha256+pepper (no
  bcrypt/argon2), sin rate-limiting ni bloqueo por intentos fallidos,
  tokens en memoria (se pierden si el servicio reinicia). No usar así en
  producción real sin endurecerlo.
- **Offline-first / store-and-forward**: la app nativa guarda en su propio
  SQLite local cuando no hay red, y reintenta contra estos mismos
  endpoints al recuperar conexión. Para que un reintento no duplique una
  observación, `CaptureTurnRequest` (y el body de `/photos/{id}/validate`)
  aceptan un `client_event_id` generado por el cliente — el servidor cachea
  la respuesta y la devuelve tal cual si ve el mismo id de nuevo. No se
  construyó un endpoint de batch-sync genérico todavía (nadie definió su
  forma exacta, y la app ni existe) — el patrón recomendado es reintentar
  estos mismos endpoints uno por uno con su `client_event_id`.
- **¿Se puede correr todo esto en un VPS cloud?** Sí. El único requisito
  del reto es que la inferencia corra on-device o delegada P2P *entre nodos
  QVAC* — nunca a una API de IA de terceros en la nube. Un VPS que vos
  controlás, corriendo QVAC como uno de los peers de la mesh, es
  exactamente eso: un nodo QVAC autorizado más, no una API cloud externa.
  La app del técnico puede vivir liviana (captura + cola offline) mientras
  el cómputo pesado (visión, voz, extracción) corre en un VPS con más
  RAM/GPU — sigue siendo 100% QVAC de punta a punta.

## Componentes

```
Frontend --POST /ask-------------> Router --POST /search--> RAG
   |                                  |
   +--POST /capture/turn(/voice)-->   |
   +--POST /photos, /query-------->  Installed Base
                                        |
                                        +--POST /infer {capability}--> Router
                                                                          |
                                                        +-----------------+-----------------+
                                                        |                 |                 |
                                                  Peer (completion)  Peer (multimodal)  Peer (transcription)
                                                  peer-medium/gpu     peer-vision         peer-voice
                                                        |                 |                 |
                                                    QVAC local        QVAC local         QVAC local
```

| Componente | Carpeta | Qué hace hoy |
|---|---|---|
| **RAG** | `services/rag` | Ingesta 4 documentos demo y los indexa con QVAC real (`rag()`/`RagRequest` de `tetherto-qvac-sdk`). `POST /search` devuelve contexto + fuentes + sensibilidad. Si el modelo de embeddings no está disponible, cae a búsqueda por keywords sobre los mismos docs — nunca se cae la demo. |
| **Router** | `services/router` | Registro de peers por auto-anuncio/heartbeat (sin IPs hardcodeadas). `POST /ask` (RAG + completion, flujo original) y `POST /infer` (nuevo: cualquier capacidad — completion/multimodal/transcription — para cualquier servicio de dominio). Es el único lugar que decide qué peer atiende cada pedido. |
| **Peer** | `services/peer` | Una imagen genérica, instanciada 4 veces (`peer-medium`, `peer-gpu`: completion; `peer-vision`: multimodal/VisionPsy Nano; `peer-voice`: transcription/Whisper), diferenciadas solo por variables de entorno (`MODEL_KIND`, `MODEL_NAME`, ...). Expone `/capabilities`, `/health`, `/infer`, `/transcribe`. Si el modelo no cargó, responde un stub explícito en vez de fallar. |
| **Installed Base** | `services/installed-base` | El reto de Philips (ver arriba): captura por texto/voz/foto, auth de técnico por PIN, detección de duplicados, confidence combinado, freshness/oportunidades, consultas en lenguaje natural, SQLite, Customer 360 y analytics. |
| **Frontend** | `services/frontend` | React/Vite con pestañas: Capturar visita (con login por PIN) / Clientes / Analytics (Installed Base) + Mesh Demo (el chat genérico original). Tipado contra `shared-ts/types.ts`. |
| **Shared** | `shared/py/qvac_mesh_shared` | Contratos Pydantic (`ExecutionPlan`, `PeerCapability`, `UsageEvent`, `RagResult`, `EquipmentObservation`, `RouterInferRequest/Result`, `TranscribeRequest/Result`, etc.) que usan todos los servicios. Paquete pip instalable (`pip install -e shared/py`). Espejo en TypeScript en `shared-ts/types.ts`. |

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

**9. Auth de técnico es el mínimo viable, no producción.**
PIN + sha256/pepper, tokens en memoria, sin rate-limiting ni rotación.
→ *Cómo abordarla*: antes de un uso real, mover a bcrypt/argon2, persistir
tokens/sesiones fuera de memoria, agregar rate-limiting y bloqueo por
intentos fallidos, y un panel de administración de técnicos en vez del
diccionario fijo en `services/installed-base/app/auth.py`.

**10. VisionPsy Nano y Whisper no se descargaron/probaron con inferencia
real en esta sandbox** (mismo motivo que los peers de texto: RAM limitada
en la máquina de desarrollo). El código de `peer-vision`/`peer-voice` está
completo y verificado contra el SDK real (signatures, shapes de request)
pero no contra un modelo cargado de verdad.
→ *Cómo abordarla*: correr `docker compose up peer-vision peer-voice` con
Docker sano y probar `/photos` y `/capture/turn/voice` con fotos/audio
reales de equipos.

**11. Sin fine-tuning real del modelo de visión.**
Las fotos + etiqueta confirmada (o corregida por el técnico) quedan
guardadas en `photo_queue` — es el dataset, no el entrenamiento.
→ *Cómo abordarla*: cuando haya suficientes fotos etiquetadas, exportar
`photo_queue` y correr un fine-tune real de VisionPsy Nano (o el VLM que se
elija) vía QVAC.

**12. No hay endpoint de batch-sync genérico para offline.**
La app nativa (cuando exista) reintenta los endpoints uno por uno con
`client_event_id` para evitar duplicados — no hay un `/sync/batch` que
reciba un lote de eventos en una sola llamada.
→ *Cómo abordarla*: definirlo junto con quien construya la app nativa,
una vez se sepa su forma real de encolar eventos localmente.

**13. Confidence no se recalcula retroactivamente.**
Si llega una tercera observación independiente confirmando un equipo, las
dos anteriores no suben de confidence — solo la nueva se beneficia de
haber encontrado duplicados previos.
→ *Cómo abordarla*: en `store.insert()`, además de calcular el confidence
de la fila nueva, hacer un `UPDATE` a los ids en `possible_duplicate_of`
recalculando el suyo con el conteo actualizado.

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
- Peer vision (fotos): http://localhost:8006
- Peer voice (audio): http://localhost:8007

La primera vez, cada Peer descarga su modelo real vía QVAC:
`peer-medium`/`peer-gpu` -> `LLAMA_3_2_1B_INST_Q4_0` (~770MB), RAG ->
`EMBEDDINGGEMMA_300M_Q4_0` (~280MB), `peer-vision` ->
`VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` + su mmproj (chico, ~460M params),
`peer-voice` -> `WHISPER_TINY` (~78MB, el más liviano de todos). Mientras
se descarga, cada servicio sigue funcionando en modo fallback (ver
"Limitaciones") — así nunca se cae la demo por falta de red/tiempo.

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

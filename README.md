# Enterprise AI Mesh — Customer Installed Base Intelligence

Prototipo de hackathon: un colaborador de campo describe (por texto, voz o
foto) el equipo médico que ve en un hospital, y el sistema lo convierte en
datos estructurados y confiables — con **toda la inferencia de IA corriendo
en el dispositivo o delegada entre nodos QVAC, nunca en una API cloud de
terceros**. Construido sobre [QVAC](https://github.com/tetherto/qvac), el
SDK local-first de Tether.

## Base preexistente declarada (requisito obligatorio de la hackathon)

Las reglas de la hackathon exigen declarar cualquier base preexistente en
el README — omitirlo descalifica, sin importar la calidad del resultado.
La hackathon es remota, sin sede física, y su ventana oficial de
construcción de 48 horas es:

> **9 de septiembre 2026, 08:00 → 11 de septiembre 2026, 08:00**

Todo el contenido de este repositorio hasta el commit `0925176`
(2026-09-08 12:41) fue construido **antes** de que abriera esa ventana —
es decir, se declara íntegramente como preparación previa, verificable con
`git log` (fechas y hashes reales):

- **2026-09-07, 16:12–16:32** (commits `ee97a05`..`53d35ed`): el mesh
  genérico — contratos compartidos en `shared/`, el servicio `rag`, el
  servicio `peer` con su integración real a `completion()` de QVAC, el
  `router` original, el frontend base, `docker-compose.yml` y el
  framework de tests. Se construyó como infraestructura de propósito
  general, sin saber todavía qué misión asignaría la hackathon.
- **2026-09-08, 11:35–12:41** (commits `969f42f`..`0925176`): al recibir
  el reto de Philips, se agregó `services/installed-base` completo
  (captura conversacional, extracción, duplicados), la extensión de
  `peer`/`router` a capacidades multimodal/transcripción, auth de
  técnico, fotos, voz, confidence combinado, freshness, oportunidades de
  renovación y consultas en lenguaje natural.

**Cualquier commit con fecha `>= 2026-09-09 08:00` en este repositorio es
trabajo genuinamente realizado dentro de la ventana oficial de 48 horas**
— mismo criterio de verificación (`git log`), sin excepción. Todo lo que
se agregue desde ese momento (verificación real con Docker, pruebas con
fotos/audio reales, la app móvil de técnicos, cualquier feature nueva)
cuenta como el producto construido dentro del plazo.

Nota honesta sobre el criterio **Technical (35%, "uso genuino de QVAC")**:
el *patrón* de integración con QVAC (`Peer` cargando un modelo real y
llamando a `completion()`) es parte de la preparación previa. La
extensión de ese patrón a modelos multimodales (fotos) y de transcripción
(voz), el enrutamiento por capacidad del Router, y toda la aplicación de
dominio (extracción conversacional, duplicados, confidence, analytics,
`/query`) que resuelve el problema real de Philips, también quedan
declarados como preparación previa bajo esta fecha de corte — no se
oculta nada, incluso lo que técnicamente podría discutirse como "ya era
sustancial". La ventana oficial (9 al 11) se usa para profundizar sobre
esa base: verificación real, pulido, y lo que falte del prototipo.

## Qué es esto, en una frase

Un mesh de microservicios (Router + Peers QVAC + RAG) que garantiza
"inferencia local/P2P, nunca cloud" por diseño, y una aplicación real
montada encima (`services/installed-base`, el reto de Philips) que la usa
para: capturar observaciones de equipo (texto/voz/foto), preguntarle al
usuario lo que falte, detectar duplicados, y dar una vista por cliente +
analytics entre clientes.

## Cómo funciona

### La regla de oro: el Router decide, los Peers ejecutan

Ningún servicio le habla nunca directo a un modelo de IA. Todos pasan por
el **Router**, que mantiene un registro de **Peers** (procesos que sí
tienen un modelo QVAC cargado) y elige cuál atiende cada pedido según la
**capacidad** que necesita:

```
                         POST /infer {capability: "completion"|"multimodal"|"transcription", ...}
Installed Base  ------------------------------------------------------------------------------->  Router
                                                                                                       |
                                                                              elige un Peer con esa capacidad
                                                                                                       |
                                        +----------------------+----------------------+----------------------+
                                        |                      |                      |
                                  Peer (completion)      Peer (multimodal)      Peer (transcription)
                                  peer-medium / peer-gpu   peer-vision            peer-voice
                                  LLAMA_3_2_1B             VisionPsy Nano 460M    Whisper Tiny
                                        |                      |                      |
                                    QVAC local              QVAC local             QVAC local
```

Esto significa que agregar una nueva capacidad de IA (otro idioma, otro
tipo de modelo) nunca requiere tocar quien la consume — solo se levanta un
Peer nuevo con la capacidad correspondiente y el Router lo empieza a usar.
Un Peer es **la misma imagen Docker** (`services/peer`) siempre; lo único
que cambia entre `peer-medium`, `peer-gpu`, `peer-vision` y `peer-voice`
son sus variables de entorno (`MODEL_KIND`, `MODEL_NAME`).

### El flujo completo de una captura (texto)

1. El técnico se autentica: `POST /auth/technician {pin}` → le devuelve un
   token.
2. Manda una observación: `POST /capture/turn {text: "..."}` con ese token.
3. `installed-base` arma un prompt de extracción y se lo pasa al Router
   (`capability: "completion"`), que elige `peer-medium` (o el que esté
   libre) y corre la inferencia real con QVAC.
4. El modelo devuelve un JSON con lo que pudo extraer (cliente, ciudad,
   equipo, cantidad, marca...) y qué falta.
5. Si falta algo importante, `installed-base` le repregunta al técnico
   (`agent_message` en la respuesta) y espera el siguiente turno
   (mandando el mismo `session_id`).
6. Cuando está completa, se guarda en SQLite: se calcula un **confidence**
   combinando completitud de datos + si ya había observaciones previas del
   mismo cliente/equipo (posible duplicado), y queda con un `status`
   (`reported`/`estimated`/`confirmed`/`unknown`).

Por **voz** es igual, salvo que primero se transcribe el audio con un Peer
de transcripción (`POST /capture/turn/voice`, capability="transcription")
y el texto resultante entra al mismo flujo del paso 3.

Por **foto** es asíncrono, para que el técnico no tenga que esperar:
`POST /photos` guarda la foto y devuelve al toque (`status: "pending"`);
un proceso en segundo plano la manda al Peer de visión
(`peer-vision`, capability="multimodal") para adivinar qué equipo es; el
técnico revisa después (`GET /photos?status=needs_review`) y confirma o
corrige (`POST /photos/{id}/validate`) — la foto queda guardada con su
etiqueta final para siempre, como dataset para un futuro reentrenamiento.

### Quién es cada carpeta

```
Frontend --POST /ask-------------> Router --POST /search--> RAG
   |                                  |
   +--POST /capture/turn(/voice)-->   |
   +--POST /photos, /query-------->  Installed Base -- POST /infer {capability} --> Router (ver diagrama arriba)
```

| Componente | Carpeta | Rol |
|---|---|---|
| **Installed Base** | `services/installed-base` | La app real (reto Philips): captura texto/voz/foto, auth por PIN, duplicados, confidence, analytics, `/query` en lenguaje natural. Es el único servicio con lógica de negocio. |
| **Router** | `services/router` | El cerebro: registro de Peers (auto-anuncio, sin IPs hardcodeadas) y `POST /infer` — decide qué Peer atiende cada capacidad. También `POST /ask` (RAG + completion, la demo genérica original del mesh). |
| **Peer** | `services/peer` | Una imagen genérica que corre un modelo QVAC real y expone `/infer`/`/transcribe`. Se instancia 4 veces con distinta config: `peer-medium`, `peer-gpu` (texto), `peer-vision` (fotos), `peer-voice` (audio). |
| **RAG** | `services/rag` | Conocimiento empresarial local (docs de ejemplo indexados con QVAC). Usado por la demo genérica del mesh (`POST /ask`), no por Installed Base. |
| **Frontend** | `services/frontend` | React/Vite: pestañas "Capturar visita" (login por PIN), "Clientes", "Analytics", más "Mesh Demo" (el chat genérico). Sirve de referencia mientras se construye la app móvil real de los técnicos. |
| **Technician App** | `apps/technician-app` | App móvil (Expo/React Native/TypeScript) para los técnicos de campo — QVAC corriendo en el propio teléfono. Changelog y README propios en esa carpeta (stack distinto al resto del monorepo). |
| **Shared** | `shared/py/qvac_mesh_shared` | Los contratos (Pydantic) que hablan todos los servicios entre sí — un solo lugar de verdad para los tipos de dato. Espejo en TypeScript en `shared-ts/types.ts`. |

## Cómo lo montás

### Requisitos

- Docker + Docker Compose (recomendado), **o** Python 3.11+ y Node 22+ si
  preferís correr los servicios sueltos.
- Nada de API keys ni cuentas externas — todo corre local.

### Opción A — Docker (recomendada)

```bash
docker compose up --build
```

Levanta 8 contenedores en una red interna:

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Router | http://localhost:8001 (`/docs` para el Swagger) |
| RAG | http://localhost:8002 |
| Peer medium | http://localhost:8003 |
| Peer GPU | http://localhost:8004 |
| **Installed Base** | http://localhost:8005 (`/docs` para el Swagger) |
| Peer vision (fotos) | http://localhost:8006 |
| Peer voice (audio) | http://localhost:8007 |

La primera vez, cada Peer descarga su modelo real vía QVAC (nada gigante):
`LLAMA_3_2_1B_INST_Q4_0` (~770MB, texto), `EMBEDDINGGEMMA_300M_Q4_0`
(~280MB, RAG), `VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` + su mmproj (fotos),
`WHISPER_TINY` (~78MB, audio — el más liviano). Mientras se descarga, cada
servicio sigue respondiendo en modo fallback (ver "Limitaciones") — la demo
nunca se cae por falta de red o tiempo.

`docker compose up --build` levanta todo en **una sola máquina** (~8-9GB
de RAM con todo cargado) — práctico para desarrollar, pero no demuestra
descentralización real. Para repartir la mesh en 2 o 3 laptops físicas de
verdad (bajando la carga por máquina a ~4-5GB), ver
[`docs/multi-host-demo.md`](docs/multi-host-demo.md).

### Opción B — sin Docker

```bash
# por cada servicio en services/<nombre>/
pip install -e shared/py -r services/<nombre>/requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd services/frontend && npm install && npm run dev
```

Ver `.env.example` para todas las variables — la regla de oro es que
**ningún servicio tiene una IP/hostname hardcodeado**: todo se descubre vía
`ROUTER_URL`/`RAG_URL`/registro de capacidades, así que mover un Peer a
otra máquina es solo cambiar esa URL, nunca tocar código.

### Verificar que arrancó bien

```bash
curl http://localhost:8005/health
curl http://localhost:8005/customers   # ya trae 20 clientes demo precargados
```

## Cómo lo usás (ejemplos reales)

```bash
# 1. Login del técnico (PINs demo en services/installed-base/app/auth.py)
TOKEN=$(curl -s -X POST http://localhost:8005/auth/technician \
  -H "Content-Type: application/json" -d '{"pin": "1234"}' | jq -r .token)

# 2. Capturar una observación por texto
curl -X POST http://localhost:8005/capture/turn \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "Estoy en Hospital DemoCare Pacific, en Panama. Tienen dos resonadores."}'

# 3. Subir una foto de una placa/etiqueta (queda en cola, no bloquea)
curl -X POST http://localhost:8005/photos \
  -H "Authorization: Bearer $TOKEN" \
  -F "photo=@equipo.jpg" -F "customer=Hospital DemoCare Pacific"

# 4. Ver fotos listas para validar, y confirmar una
curl http://localhost:8005/photos?status=needs_review
curl -X POST http://localhost:8005/photos/1/validate \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"confirmed": true}'

# 5. Preguntar en lenguaje natural sobre el dataset (no requiere login)
curl -X POST http://localhost:8005/query \
  -H "Content-Type: application/json" \
  -d '{"question": "clientes en Panama con equipos MR"}'

# 6. Vista por cliente y analytics agregado (tampoco requieren login)
curl http://localhost:8005/customers/"Hospital DemoCare Pacific"
curl http://localhost:8005/analytics
```

O simplemente abrí http://localhost:5173 y usá la pestaña "Capturar visita"
(pide el mismo PIN) — es la misma API, con interfaz.

## Tests

```bash
# setup (una vez por venv)
pip install -e shared/py -r requirements-test.txt \
    -r services/rag/requirements.txt \
    -r services/router/requirements.txt \
    -r services/peer/requirements.txt \
    -r services/installed-base/requirements.txt
cd services/frontend && npm install && cd ../..

python scripts/run_tests.py                    # todos los modulos
python scripts/run_tests.py --modules rag router  # un subconjunto
python scripts/run_tests.py --list             # ver nombres disponibles
```

Módulos: `shared`, `rag`, `router`, `peer`, `installed-base`, `frontend`,
`technician-app`. Los tests corren contra peers **mockeados** a propósito
(mismo patrón en todos los módulos) para no depender de descargar modelos,
tener Docker/red disponible, ni un teléfono físico conectado — la
inferencia real se prueba levantando el mesh de verdad (`docker compose
up`) y probando con los ejemplos de arriba, o corriendo `technician-app` en
un dispositivo (ver `apps/technician-app/README.md`).

`technician-app` es la excepción: no tiene suite de tests en este momento
(se perdió al reemplazar su UI de smoke-test por el flujo real de captura,
ver su CHANGELOG.md), así que su entrada en `run_tests.py` corre
`typecheck` en su lugar -- verifica tipos, no comportamiento.

## Arquitectura a la que apunta el proyecto completo

Lo que corre hoy es un **walking skeleton**: prueba que "conocimiento local
→ decisión del Router → inferencia local/P2P → resultado" funciona de
punta a punta de verdad, no mockeado. La meta completa del Enterprise AI
Mesh (más allá de Installed Base) agrega:

```
USUARIO -> ASSISTANT -> AI ROUTER (local)
                            |
                            +-> RAG LOCAL (conocimiento empresarial)
                            +-> clasifica privacidad + complejidad
                            +-> Small/Medium/Large
                                   |
                    capacidad suficiente? --NO--> P2P a otro nodo QVAC autorizado
                                   |
                                  SI -> inferencia local
                                   |
                              USAGE METER -> dashboard -> settlement USDt/WDK
```

Y para Installed Base específicamente, la meta es que cada técnico tenga
una **app móvil** (`apps/technician-app`, Expo/React Native/TypeScript —
QVAC en mobile corre así, no hay SDK nativo Kotlin) funcionando como nodo
offline-first: corre la extracción de texto **en el propio teléfono**
(nada de infraestructura en el hospital del cliente — solo el celular), y
sincroniza contra estos mismos endpoints cuando recupera conexión. Por eso
`CaptureTurnRequest` y `/photos/{id}/validate` ya aceptan un
`client_event_id`: si la app reintenta un envío que ya se procesó, el
servidor devuelve la respuesta cacheada en vez de duplicar la observación.
Ver `apps/technician-app/README.md` para el estado actual: ya es el flujo
real (login por PIN, captura conversacional multi-sesión con extracción
on-device, voz, cola SQLite offline, confirmación humana antes de guardar,
y sync contra estos mismos endpoints) -- falta captura por foto en la app
(el backend ya la soporta) y una suite de tests automatizados.

**¿Se puede correr esto en un VPS cloud?** Sí — el único requisito es que
la inferencia corra on-device o delegada P2P *entre nodos QVAC*, nunca a
una API de IA de terceros. Un VPS propio corriendo QVAC como uno de los
Peers del mesh es exactamente eso: un nodo QVAC autorizado más, no una API
cloud externa. La app del técnico puede ser liviana (captura + cola
offline) mientras el cómputo pesado corre en un VPS con más RAM/GPU.

## Limitaciones actuales y cómo abordarlas luego

**1. QVAC no tiene una primitiva de "delegated inference" lista para usar.**
Su P2P real (Hyperswarm/Hyperdrive + blind relays) sirve para *descargar
modelos* entre peers, no para enrutar cómputo de inferencia. La "red P2P"
de este proyecto es una capa de aplicación construida encima de QVAC
(Router llamando por HTTP normal a un Peer), no algo que QVAC resuelva
solo. → Es una decisión de diseño ya tomada y funcionando, no un bug.

**2. `peer-gpu` corre el mismo modelo chico que `peer-medium`** (para no
forzar una descarga grande en el baseline), sin lógica real de selección
entre peers del mismo tier. → Cambiar `MODEL_NAME` en `docker-compose.yml`
a un modelo grande real + GPU cuando haga falta; el código no cambia.

**3. Clasificación de complejidad/privacidad del Router (`POST /ask`) es
un heurístico simple** (longitud/palabras clave), no un clasificador real.
→ Reemplazar `classify_complexity` en `services/router/app/policy.py`
cuando se conozcan los casos de uso reales; el contrato no cambia.

**4. Sin P2P real entre máquinas físicas** — los peers son contenedores en
un solo host. → Mover uno a otra máquina es, por diseño, solo cambiar
`ROUTER_URL`/`PEER_*_URL` en su `.env`; no requiere tocar código.

**5. Sin settlement económico real** — `UsageEvent.settlement_status`
queda en `"not_implemented"` a propósito; es una capa secundaria de
contabilidad, no el centro del MVP.

**6. RAG indexa 4 documentos demo**, no una base de conocimiento real. →
Reemplazar `DEMO_DOCUMENTS` en `services/rag/app/demo_docs.py`; la interfaz
`POST /search` no cambia.

**7. `docker compose up --build` no se corrió de punta a punta en esta
sesión** (Docker Desktop tuvo problemas en la máquina de desarrollo) — sí
se validó cada servicio por separado (tests unitarios, `docker compose
config`). Si el build falla, ver el punto 8.

**8. Caveat de Windows: `install-worker` de `tetherto-qvac-sdk` puede no
detectar `npm`** corriendo desde Git Bash/PowerShell nativo (problema del
instalador del SDK, no de este repo — no debería pasar dentro del
contenedor Docker). → Si aparece: `npm install -g @qvac/sdk@<version>` y
apuntar `QVAC_SDK_DIR`/`QVAC_WORKER_PATH` a esa instalación.

**9. Auth de técnico es el mínimo viable, no producción.** PIN +
sha256/pepper, tokens en memoria, sin rate-limiting ni rotación. → Antes de
un uso real: bcrypt/argon2, tokens persistidos, rate-limiting, y un panel
de administración en vez del diccionario fijo en `app/auth.py`.

**10. VisionPsy Nano y Whisper no se probaron con inferencia real** en
esta sandbox (RAM limitada en la máquina de desarrollo) — el código está
completo y verificado contra el SDK real, pero no contra un modelo
cargado de verdad. → Correr `docker compose up peer-vision peer-voice` con
Docker sano y probar con fotos/audio reales.

**11. Sin fine-tuning real del modelo de visión** — las fotos + etiqueta
confirmada quedan guardadas en `photo_queue` como dataset, no como modelo
entrenado. → Exportarlas y correr un fine-tune real vía QVAC cuando haya
volumen suficiente.

**12. No hay endpoint de batch-sync genérico para offline** — el patrón
hoy es reintentar los endpoints uno por uno con `client_event_id`. →
Definir un `/sync/batch` junto con quien construya la app nativa, una vez
se sepa su forma real de encolar eventos localmente.

**13. Confidence no se recalcula retroactivamente** — una tercera
observación independiente no sube el confidence de las dos anteriores. →
En `store.insert()`, además de calcular el confidence de la fila nueva,
actualizar los ids en `possible_duplicate_of` con el conteo nuevo.

## Changelog

Cada cambio a un componente se registra en `CHANGELOG.md`, en la sección de
ese componente, con el hash del commit que lo introdujo. Workflow: hacé el
commit del cambio, tomá su hash corto (`git rev-parse --short HEAD`), y
agregá una línea a la sección correspondiente en un commit chico de
`docs: changelog <hash>`.

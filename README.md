# Technician App (mobile)

## Base preexistente declarada (requisito obligatorio de la hackathon)

Las reglas de la hackathon exigen declarar cualquier base preexistente en
el README. La ventana oficial de construcción es:

> **9 de septiembre 2026, 08:00 → 11 de septiembre 2026, 08:00**

Todo el historial de esta rama hasta el commit `b2a91ba8e0b9392b3289b0e095a0207b5137e62f`
(2026-09-08 23:32:44) fue construido **antes** de que abriera esa ventana —
preparación previa, verificable con `git log`. Es el mismo scaffold y
avance de la app móvil ya declarado en el README de
`challenge/philips-installed-base` (de donde se sincronizó esta rama);
esta rama solo aísla esa misma app en su propio historial para
entregarla por separado.

Cualquier commit con fecha `>= 2026-09-09 08:00` en esta rama es trabajo
genuinamente realizado dentro de la ventana oficial de 48 horas.

App para los técnicos de campo del reto Philips (`services/installed-base`):
captura la observación de una visita (texto o voz) directo en el teléfono,
corre la extracción con QVAC **en el dispositivo** (sin red, sin backend de
por medio), y sincroniza contra `services/installed-base` cuando hay
conexión. Login por PIN de técnico, cola offline en SQLite, y una capa de
confirmación humana antes de guardar cualquier dato extraído por el modelo.

## Por qué Expo, no Kotlin/Android Studio nativo

QVAC en mobile corre vía [Expo](https://docs.qvac.tether.io/tutorials/expo/)
(React Native + TypeScript), no hay SDK nativo Kotlin. Es el mismo stack
TypeScript que ya usamos en `services/frontend`, así que reusamos criterio y
tooling.

**QVAC no corre en emuladores** (limitación de llamacpp) — todo el
desarrollo/prueba de esta app necesita un dispositivo físico conectado, y
por eso se compila en la nube con **EAS Build** (ver más abajo) en vez de
`expo run:android` local.

## Estado actual

Flujo real de captura, no un smoke test:

- **Login**: PIN contra `POST /auth/technician`. Si el servidor no responde,
  cae a login offline contra una cache local de hashes de PIN (sincronizada
  la última vez que hubo conexión vía `GET /auth/roster`) — y si nunca hubo
  ninguna conexión, un fallback de PINs demo hardcodeados como último
  recurso.
- **Captura conversacional multi-sesión**: se pueden tener varias
  "visitas" abiertas a la vez (una por cliente). Cada sesión vive en SQLite
  (`capture_sessions`), no en memoria — cambiar de pestaña, abrir otra
  sesión, o cerrar la app no pierde una conversación en curso. El LLM
  (`LLAMA_3_2_1B_INST_Q4_0`, forzado a `device: "cpu"`) corre la extracción
  con `responseFormat: json_schema` (grammar constraint real de llama.cpp,
  no solo instrucción de prompt) y `kvCache: true` para no reprocesar toda
  la conversación en cada mensaje. Solo una inferencia corre a la vez
  (un único modelo cargado en el dispositivo), así que un segundo mensaje en
  otra sesión simplemente espera su turno.
- **Captura por voz**: graba con `expo-av`, transcribe on-device con
  Whisper (`WHISPER_TINY`, `beam_search`) y entra al mismo pipeline de
  extracción que el texto.
- **Confirmación antes de guardar**: cuando el modelo dice que ya tiene
  todo, no escribe directo a SQLite -- muestra un resumen y pide
  "Confirmar y guardar" explícito. Pensado como defensa contra
  alucinaciones en campos sin default posible (cantidad, marca, modelo) --
  ver "Alucinaciones" más abajo.
- **País de operación configurable**: en vez de dejar que el modelo adivine
  el país (alucinaba uno inventado en pruebas reales), la Configuración
  tiene un campo de país que se usa siempre que está seteado.
- **Cola offline + sync**: observaciones confirmadas se guardan en SQLite
  local (`observations`, estado `pending`/`synced`/`failed`) y se
  sincronizan contra `POST /sync` (batch, idempotente por
  técnico+id-local) cuando hay conexión.
- **Servidor configurable en la app**: la URL del backend se pide la
  primera vez (con botón "Probar conexión") y se guarda en SQLite, editable
  después desde un ícono de engranaje -- no requiere rehacer el build de
  EAS para apuntar a otra red.

### Lo que falta / no está implementado

- **Foto**: `expo-camera` está como dependencia pero no hay UI de captura
  de fotos en la app todavía (el backend sí soporta `POST /photos` +
  cola de revisión -- ver `services/installed-base`). Pendiente de un
  próximo sprint.
- **Suite de tests**: no hay tests automatizados en este momento (ni Jest
  ni testing-library instalados). El smoke test original tenía cobertura
  con el ciclo de vida de QVAC mockeado; se perdió al reemplazar esa UI por
  el flujo real y no se reconstruyó todavía -- deuda técnica conocida, no
  un descuido silencioso.
- **Batch-sync genérico multi-entidad**: `POST /sync` cubre observaciones;
  fotos/voz siguen yendo por los endpoints dedicados del backend.

## Arquitectura de captura (por qué está separada así)

- `src/capture/sessionRunner.ts`: corre una sesión de principio a fin
  leyendo y escribiendo *solo* contra SQLite, sin referencia a ningún
  componente de React. Se llama sin esperar (`fire and forget`) desde la
  UI a propósito -- si el técnico cambia de pantalla antes de que el modelo
  responda, la extracción sigue corriendo y su resultado se persiste igual.
  La UI de `CaptureScreen.tsx` solo lee/escribe el mismo estado vía polling
  cuando una sesión está `processing`.
- `src/qvac/models.ts`: expone `runCompletion`/`ensureLLM`/`ensureWhisper`
  y serializa todo acceso al LLM con una cola en memoria -- hay un solo
  modelo cargado en el dispositivo, así que dos sesiones no pueden correr
  inferencia en paralelo de verdad, sin importar cuántas sesiones abiertas
  haya.
- `src/qvac/extraction.ts`: contrato de extracción (mismo JSON que usa
  `services/installed-base/app/extraction.py` en el backend), con
  `responseFormat: json_schema` para forzar la forma del JSON a nivel de
  grammar, no solo pedirlo en el prompt.

## Alucinaciones -- qué se mitigó y cómo

Un modelo de 1B en el dispositivo va a inventar datos ocasionalmente. Tres
capas distintas, cada una para un tipo de campo distinto:

1. **Forma del JSON**: `responseFormat: json_schema` garantiza a nivel de
   grammar que la salida es un JSON válido con las claves correctas -- esto
   es una garantía real, no una esperanza.
2. **Campos con un default estable** (país): la app lo fuerza
   determinísticamente desde Configuración en vez de confiar en que el
   modelo lo adivine bien. Elimina esa alucinación por completo, no la
   mitiga.
3. **Campos sin default posible** (cantidad, marca, modelo de equipo): no
   hay forma de forzarlos de antemano. La única defensa real es un humano
   revisando antes de guardar -- de ahí el paso de confirmación explícita.
   Las instrucciones del prompt también piden explícitamente no inventar
   estos datos, pero eso es un pedido, no una garantía.

## Cómo compilar (EAS Build)

```bash
npx eas-cli build --profile preview --platform android
```

El bundle del worker de QVAC (`qvac/worker.bundle.js`) viene pre-generado y
commiteado -- el plugin de Expo (`app.plugin.js`) lo copia en el paso de
prebuild en vez de invocar `bare-pack` en el contenedor de build de EAS
(ver el CHANGELOG para el porqué: `bare-pack` fallaba de forma intermitente
en Linux). Si el bundle queda desactualizado tras cambiar dependencias de
QVAC, regenerarlo con:

```bash
node qvac-bundle.mjs .
```

## Configuración en el dispositivo

Al abrir la app por primera vez pide la URL del servidor
`services/installed-base` en tu red local (ej. `http://192.168.1.42:8005`,
la IP real de la laptop corriendo `docker compose`, no un valor fijo) y,
opcionalmente, el país de operación. Ambos se guardan en SQLite y son
editables después desde el ícono ⚙.

## Tests

```bash
npm run typecheck
```

No hay `npm test` en este momento -- ver "Lo que falta" arriba.

## Changelog

Ver `CHANGELOG.md` en esta misma carpeta — changelog propio de la app,
separado del changelog raíz del monorepo (distinto ciclo de vida/stack).

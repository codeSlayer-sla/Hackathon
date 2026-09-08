# Technician App (mobile)

App para los técnicos de campo del reto Philips (`services/installed-base`):
captura la observación (texto, voz o foto más adelante) directo en el
teléfono, corre la extracción con QVAC **en el dispositivo** (sin red), y
sincroniza contra el backend cuando hay conexión.

## Por qué Expo, no Kotlin/Android Studio nativo

QVAC en mobile corre vía [Expo](https://docs.qvac.tether.io/tutorials/expo/)
(React Native + TypeScript), no hay SDK nativo Kotlin. Es el mismo stack
TypeScript que ya usamos en `services/frontend`, así que reusamos criterio y
tooling.

**QVAC no corre en emuladores** (limitación de llamacpp) — todo el
desarrollo/prueba de esta app necesita un dispositivo físico conectado.

## Estado actual

Por ahora es el **smoke test** del ciclo de vida de QVAC (descarga de
modelo → carga → inferencia local), tal como lo arma el tutorial oficial —
el paso de validación previo a construir el flujo real de captura. Corre
`LLAMA_3_2_1B_INST_Q4_0` completo en el teléfono, sin backend de por medio.

Lo que falta para que sea la app real (próxima iteración):

- Reemplazar la UI del smoke test por el flujo de captura conversacional
  (igual en espíritu a `services/frontend/src/installedBase/CaptureView.tsx`,
  pero corriendo la extracción localmente en vez de pegarle al Router).
- Cola local (SQLite vía `expo-sqlite`) para guardar observaciones cuando no
  hay red.
- Sincronización contra `services/installed-base` (`POST /capture/turn`,
  `POST /photos`, etc.) usando el mismo `client_event_id` para reintentos
  idempotentes — mismo contrato REST que ya consume el frontend web.
- Login por PIN de técnico (`POST /auth/technician`) antes de sincronizar.
- Evaluar si foto/voz también corren on-device (VisionPsy Nano y Whisper
  Tiny son chicos, viables en teléfono) o si esas dos capacidades siguen
  delegando a un Peer de la empresa cuando hay señal (P2P, permitido por el
  brief) mientras el texto es siempre local.

## Cómo correr

```bash
npm install
npx expo prebuild       # genera los proyectos nativos ios/ android
npx expo run:android --device   # o run:ios --device
```

Necesita: Expo configurado en tu máquina (ver
[Expo docs — set up your environment](https://docs.expo.dev/get-started/set-up-your-environment/)),
y un teléfono físico conectado.

## Tests

```bash
npm test        # Jest + React Native Testing Library
npm run typecheck
```

El ciclo de vida nativo de QVAC (`bare-rpc`, `react-native-bare-kit`) no
corre en Jest — no hay dispositivo físico ni puente nativo en el entorno de
test. Los tests mockean el límite del SDK (`@qvac/sdk`) y prueban nuestra
propia máquina de estados (Descargando → Cargando → Corriendo → Listo),
mismo criterio que usamos en todo el backend (mockear el borde externo,
probar la lógica propia).

## Changelog

Ver `CHANGELOG.md` en esta misma carpeta — changelog propio de la app,
separado del changelog raíz del monorepo (distinto ciclo de vida/stack).

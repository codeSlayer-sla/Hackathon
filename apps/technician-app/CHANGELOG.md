# Changelog — Technician App (mobile)

Changelog propio de esta app, separado del `CHANGELOG.md` raíz del monorepo
(stack y ciclo de vida distintos -- Expo/TypeScript vs. los servicios
Python/Node). Mismo formato: `hash` + fecha + qué cambió, entradas nuevas
arriba.

## Setup

- `4368696` 2026-09-09: direccion del servidor configurable dentro de la app (primer uso + boton de engranaje despues) en vez de fija en el build via `EXPO_PUBLIC_PHILIPS_SERVER` -- cambiar de red ya no requiere rehacer el build de EAS
- `bd2deec` 2026-09-09: login offline ahora contra una cache local de hashes de PIN (`technicians_cache`, sincronizada via `GET /auth/roster` en cada login online exitoso o cuando `SyncScreen` detecta conexion) en vez de una lista de PINs hardcodeada -- mismo hash sha256+pepper que usa el servidor
- `3cb0645` 2026-09-09: reemplazado el smoke test por el flujo real (login PIN con fallback offline, captura conversacional con extraccion on-device, cola SQLite local, pantalla de registros, sync al backend); nueva estrategia de bundling QVAC para EAS -- worker bundle pre-generado y commiteado (`qvac/`) copiado en prebuild via `app.plugin.js`, en vez de invocar bare-pack en el build de la nube; LLM forzado a `device: "cpu"` (crash nativo justo al terminar de cargar en un dispositivo real -- Android no tiene aun soporte de GPU confirmado por QVAC); pendiente: se perdio la suite Jest/RNTL del smoke test, hay que reconstruirla para el flujo nuevo
- `5a9d038` 2026-09-08: `postinstall` fuerza el bit de ejecución de `node_modules/bare-pack/bin.js` -- el error 127 volvió a ocurrir tras mover `bare-pack` a dependencies; leyendo la fuente real de `@qvac/sdk` (`bare-pack.ts`) se confirmó que en Linux el bundler ejecuta `bin.js` directo (shebang + permiso de ejecución) en vez de invocarlo vía `node.exe` como hace en Windows, así que el contenedor de build de EAS puede perder ese bit al instalar
- `69728ab` 2026-09-08: `bare-pack` movido de devDependencies a dependencies -- EAS Build lo necesita en el paso de prebuild de QVAC y no instala devDependencies en el perfil `preview`
- `51af261` 2026-09-08: EAS Build configurado (`eas.json`, `android.package`, `extra.eas.projectId`) para compilar el APK Android en la nube sin Android Studio local
- `8df8643` 2026-09-08: scaffold inicial (Expo SDK 54 + TypeScript), `@qvac/sdk` instalado y configurado (expo-plugin, minSdkVersion 29, `qvac.config.json` con `llamacpp-completion`), smoke test end-to-end del ciclo de vida de QVAC (descarga -> carga -> inferencia local) con Jest + React Native Testing Library

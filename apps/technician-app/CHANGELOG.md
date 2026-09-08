# Changelog — Technician App (mobile)

Changelog propio de esta app, separado del `CHANGELOG.md` raíz del monorepo
(stack y ciclo de vida distintos -- Expo/TypeScript vs. los servicios
Python/Node). Mismo formato: `hash` + fecha + qué cambió, entradas nuevas
arriba.

## Setup

- `51af261` 2026-09-08: EAS Build configurado (`eas.json`, `android.package`, `extra.eas.projectId`) para compilar el APK Android en la nube sin Android Studio local
- `8df8643` 2026-09-08: scaffold inicial (Expo SDK 54 + TypeScript), `@qvac/sdk` instalado y configurado (expo-plugin, minSdkVersion 29, `qvac.config.json` con `llamacpp-completion`), smoke test end-to-end del ciclo de vida de QVAC (descarga -> carga -> inferencia local) con Jest + React Native Testing Library

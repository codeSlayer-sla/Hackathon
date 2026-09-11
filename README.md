# 🏦 CajaAI — Decentralized AI Banking

> **Local Intelligence. Private Banking. Smarter Decisions.**

CajaAI es un asistente bancario local-first diseñado para el reto de *Caja de Ahorros*. Ejecuta asistencia financiera e inferencia de IA **100% en el dispositivo** mediante el SDK de Tether QVAC y Qwen3 600M, eliminando la necesidad de enviar datos sensibles a la nube.

---

## ⚡ Características Principales

- 💬 **Asistente Bancario Local:** Responde consultas sobre cuentas, préstamos y finanzas personales combinando Qwen3 600M con un motor de conocimiento financiero local.
- 🛡️ **Protección contra Phishing:** Detecta intentos de fraude y mensajes sospechosos mediante reglas de seguridad determinísticas e independientes del modelo generativo.
- 🧮 **Simulador de Ahorros:** Realiza cálculos de aportes e intereses de forma totalmente determinística, offline y sin consumo de APIs.

---

## 🛠️ Arquitectura Local-First

```text
               🏦 Usuario (Expo / React Native)
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
 💬 Asistente             🛡️ Seguridad             🧮 Simulador
       │                        │                        │
       ▼                        ▼                        ▼
Conocimiento Local     Reglas Determinísticas     Matemática Local
       │
       ▼
 Runtime QVAC ──► Qwen3 600M ──► Respuesta Limpia
```

---

## 🧩 Componentes del Repositorio

| Componente | Ruta | Descripción |
|---|---|---|
| CajaAI App | `apps/caja` | Cliente móvil en Expo / React Native (Android, iOS, Web) |
| QVAC Runtime | `apps/caja/src/lib/localAiService.native.ts` | Integración nativa para la ejecución local de Qwen3 |
| Conocimiento Local | `apps/caja/src/lib/knowledgeRetriever.ts` | Motor de contexto relevante para evitar alucinaciones |
| Seguridad | `apps/caja/src/app/security.tsx` | Analizador determinístico de riesgo de phishing |
| Simulador | `apps/caja/src/app/simulator.tsx` | Calculadora de rendimiento de ahorro offline |
| Validación | `apps/caja/scripts/validate.mjs` | Test suite automatizado para reglas determinísticas |

---

## ⚙️ Inferencia Offline (QVAC + Qwen3 600M)

El proyecto utiliza `QWEN3_600M_INST_Q4` ejecutado vía CPU en el dispositivo.

```text
[ Entrada del Usuario ] ──► [ Contexto Local ] ──► [ QVAC Runtime ] ──► [ Qwen3 600M ] ──► [ Respuesta ]
```

- **Sin dependencias cloud:** Una vez descargado el modelo, la app no requiere conexión a internet para procesar consultas.
- **Separación de responsabilidades:** La IA generativa se utiliza solo para lenguaje y explicaciones; la seguridad y las matemáticas corren bajo lógica determinística.

---

## 🚀 Guía de Inicio Rápido

### 1. Instalación

```bash
cd apps/caja
npm install
```

### 2. Ejecución Web (Fallback Mode)

```bash
npx expo start --web
```

### 3. Ejecución en Android Nativo (QVAC Real)

```bash
# Iniciar Metro
npx expo start --port 8081

# Configurar redirección ADB
adb reverse tcp:8081 tcp:8081

# Compilar APK Debug
cd android && ./gradlew.bat :app:assembleDebug
```

### 4. Ejecutar Suite de Validación

```bash
node scripts/validate.mjs
```

---

## 🗺️ Roadmap de Evolución

- **Fase 1 (MVP Actual):** Inferencia local on-device + Conocimiento local + Reglas determinísticas.
- **Fase 2 (RAG Avanzado):** Embeddings locales y base de datos vectorial en el dispositivo.
- **Fase 3 (Red P2P):** Enrutamiento a Nodos Bancarios de Confianza (Peer Inference) cuando el dispositivo requiera mayor potencia de cómputo.

---

## 🛡️ Licencia & Créditos

Desarrollado para el hackathon de Caja de Ahorros. Impulsado por Tether QVAC SDK.

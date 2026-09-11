/**
 * Local AI service abstraction for CajaAI.
 *
 * The UI depends ONLY on this interface. The active implementation is
 * selected per platform and exposed from `./localAiService`:
 *
 *   - Android / iOS: `QvacAIService` (real local QVAC inference, Qwen3 600M)
 *     via `localAiService.native.ts`.
 *   - Web: `LocalMockAIService` (clearly marked demo fallback — QVAC is a
 *     native-only runtime and is intentionally NOT faked on web) via
 *     `localAiService.web.ts`.
 *
 * Model reference (benchmarked in `services/peer/benchmarks/`):
 * `QWEN3_600M_INST_Q4` → `Qwen3-0.6B-Q4_0.gguf` (~364.5 MiB), engine
 * `llamacpp-completion`. Proven local + offline with QVAC.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface LocalAIService {
  /** Short human-readable status shown in the UI. */
  readonly providerLabel: string;
  generateBankingResponse(prompt: string): Promise<string>;
  /** Reset conversation history (called when the user clears the chat). */
  clearHistory(): void;
}

const cannedResponses: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ["cuenta de ahorro", "qué es una cuenta", "que es una cuenta"],
    response:
      "Una cuenta de ahorro es un producto bancario que te permite guardar tu dinero de forma segura mientras genera un pequeño interés.\n\n" +
      "• Tu dinero está disponible cuando lo necesitas.\n" +
      "• El banco te paga un interés por mantenerlo.\n" +
      "• No está pensada para pagos diarios, sino para acumular.\n\n" +
      "Consejo: revisa siempre la tasa de interés, comisiones y requisitos mínimos antes de abrir una.",
  },
  {
    keywords: ["empezar a ahorrar", "cómo ahorrar", "como ahorrar", "poco dinero", "ingresos limitados"],
    response:
      "Para empezar a ahorrar, incluso con pocos ingresos:\n\n" +
      "1. Define una meta clara (fondo de emergencia, viaje, etc.).\n" +
      "2. Ahorra primero: aparta un porcentaje apenas recibas tu ingreso.\n" +
      "3. Empieza con una cantidad pequeña pero constante.\n" +
      "4. Separa tu dinero de ahorro de tu dinero de gasto.\n\n" +
      "Ejemplo: con 1.000 $ de ingreso, apartar 10% = 100 $ al mes. La constancia importa más que la cantidad.",
  },
  {
    keywords: ["tasa de interés", "tasa de interes", "interés", "interes"],
    response:
      "La tasa de interés es el porcentaje que se usa para calcular cuánto crece tu dinero (en ahorro) o cuánto te cuesta (en préstamos).\n\n" +
      "Ejemplo: si tienes 100 $ al 5% anual, recibes 5 $ de interés al año.\n\n" +
      "Es una medida educativa simple: el interés compuesto hace que tu dinero crezca más rápido cuanto más tiempo lo dejes.",
  },
  {
    keywords: ["diferencia", "ahorro y corriente", "ahorro o corriente"],
    response:
      "La diferencia principal:\n\n" +
      "• Cuenta de ahorro: sirve para guardar dinero y generar interés. Está pensada para conservar, no para pagos frecuentes.\n" +
      "• Cuenta corriente: sirve para operaciones del día a día: cobrar tu salario, pagar servicios, transferir y recibir pagos.\n\n" +
      "En general, la cuenta de ahorro suele ofrecer un interés por tu saldo, mientras que la corriente prioriza la liquidez. La opción correcta depende de tu objetivo.",
  },
];

function pickResponse(prompt: string): string {
  const text = prompt.toLowerCase();
  for (const item of cannedResponses) {
    if (item.keywords.some((k) => text.includes(k))) {
      return item.response;
    }
  }
  return (
    "Soy tu asistente financiero local (modo demostración).\n\n" +
    "Aún estoy en versión de prueba con respuestas locales deterministas, así que no tengo una respuesta específica para esa consulta.\n\n" +
    "Puedo ayudarte con temas como: qué es una cuenta de ahorro, cómo empezar a ahorrar, tasas de interés y diferencias entre ahorro y corriente.\n\n" +
    "Pronto conectaré con el modelo local Qwen3 600M a través de QVAC para responder con contenido generado en tu dispositivo."
  );
}

/**
 * Deterministic local mock. Used as the WEB fallback (QVAC does not run on
 * web — this is a clearly marked dev fallback, not a fake of QVAC) and as a
 * safe base implementation.
 */
export class LocalMockAIService implements LocalAIService {
  readonly providerLabel: string;

  constructor(label: string = "Mock local determinista (sin modelo)") {
    this.providerLabel = label;
  }

  async generateBankingResponse(prompt: string): Promise<string> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return "Escribe tu pregunta y con gusto te ayudo.";
    }
    // Small artificial delay so the UI can exercise the loading state.
    await new Promise((resolve) => setTimeout(resolve, 450));
    return pickResponse(trimmed);
  }

  clearHistory(): void {
    // Mock has no conversation state.
  }
}
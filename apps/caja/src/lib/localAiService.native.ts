/**
 * Native (Android/iOS) binding for `LocalAIService`: real local QVAC inference
 * with Qwen3 600M + a local banking knowledge base.
 *
 * - Loads `QWEN3_600M_INST_Q4` ONCE via `loadModel()` and reuses the returned
 *   model id for every message (module-level, so it survives screen changes).
 * - Retrieves relevant local banking context for the user's question and
 *   injects it into the system message before `completion()`.
 * - Generates non-streaming responses via `completion({ stream: false })`.
 * - Uses `device: 'cpu'` (QVAC has no accepted Android physical-device GPU
 *   path yet) and caps `predict: 300` so a repetitive small model can't loop
 *   forever without emitting EOS.
 * - Maintains conversation history so Qwen3 can answer follow-up questions
 *   coherently. History is cleared when the user resets the chat.
 * - Strips ` thinking` reasoning blocks with `cleanResponse()` before display.
 *
 * Metro resolves this file for Android/iOS (`*.native.ts` beats the base
 * file); tsc uses the base `localAiService.ts` for module resolution.
 */

import {
  completion,
  loadModel,
  QWEN3_600M_INST_Q4,
} from "@qvac/sdk";
import { formatKnowledgeContext, KNOWLEDGE_BASE } from "./knowledge";
import { retrieveKnowledge } from "./knowledgeRetriever";
import { LocalAIService } from "./localAi";
import { cleanResponse } from "./responseCleaner";

const SYSTEM_PROMPT = `Eres CajaAI, un asistente financiero local que funciona sin conexión a internet.

INSTRUCCIONES:
- Responde SIEMPRE en español, a menos que el usuario pida otro idioma.
- Sé breve: responde en máximo 3-4 párrafos cortos.
- Usa el CONTEXTO LOCAL proporcionado cuando sea relevante para responder.
- NO inventes datos, cifras, comisiones, tasas ni requisitos que no estén respaldados por el contexto.
- Distingue la educación financiera general de las políticas específicas de una entidad bancaria.
- Si el contexto no contiene información verificada sobre un dato concreto, dilo explícitamente.
- Este prototipo es educativo (hackathon) y NO presenta información como política oficial de Caja de Ahorros a menos que esté verificada.
- Si el usuario menciona phishing, fraude, robo de identidad o mensajes sospechosos, prioriza la seguridad: recomienda NO hacer clic en enlaces, NO compartir contraseñas, PIN ni códigos, y contactar el canal oficial de su banco.
- NO expongas tu razonamiento interno, ni cadena de pensamiento, ni contenido de bloques "thinking". Solo muestra la respuesta final al usuario.`;

const MAX_HISTORY_PAIRS = 10;

const MODEL_CONFIG = {
  device: "cpu" as const,
  ctx_size: 2048,
  predict: 300,
};

let modelId: string | null = null;
let loadPromise: Promise<string> | null = null;

function ensureModel(): Promise<string> {
  if (modelId) {
    return Promise.resolve(modelId);
  }
  if (!loadPromise) {
    loadPromise = loadModel({
      modelSrc: QWEN3_600M_INST_Q4,
      modelConfig: MODEL_CONFIG,
    })
      .then((id) => {
        modelId = id;
        return id;
      })
      .catch((error) => {
        // Allow retrying instead of caching the failure forever.
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

/** Module-level conversation history. Survives screen changes. */
const conversationHistory: Array<{ role: string; content: string }> = [];

class QvacAIService implements LocalAIService {
  readonly providerLabel = "QVAC Local · Qwen3 600M · Offline compatible";

  async generateBankingResponse(prompt: string): Promise<string> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return "Escribe tu pregunta y con gusto te ayudo.";
    }
    const id = await ensureModel();

    // 1) Retrieve the most relevant local banking context for this question.
    const relevant = retrieveKnowledge(trimmed, KNOWLEDGE_BASE, {
      maxResults: 3,
      minScore: 1,
    });
    const localContext = formatKnowledgeContext(relevant);

    // 2) Build the system message: instructions + (optional) local context.
    const systemContent = localContext
      ? `${SYSTEM_PROMPT}\n\n${localContext}`
      : SYSTEM_PROMPT;

    // 3) Keep conversation history so follow-ups stay coherent.
    conversationHistory.push({ role: "user", content: trimmed });
    while (conversationHistory.length > MAX_HISTORY_PAIRS * 2) {
      conversationHistory.shift();
    }

    const history = [
      { role: "system" as const, content: systemContent },
      ...conversationHistory,
    ];

    // 4) Generate with real Qwen3 600M via QVAC.
    const run = completion({
      modelId: id,
      history,
      stream: false,
    });

    // 5) Clean reasoning blocks and surface only the final answer.
    const final = await run.final;
    const reply = cleanResponse(final.contentText ?? "");

    conversationHistory.push({ role: "assistant", content: reply });

    return reply;
  }

  clearHistory(): void {
    conversationHistory.length = 0;
  }
}

export const localAiService: LocalAIService = new QvacAIService();
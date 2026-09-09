import { runCompletion, type ConversationTurn } from './models';

const SYSTEM_INSTRUCTIONS = `Extraes datos estructurados de observaciones de equipos médicos de visitas a hospitales.

Extrae cuando esté disponible:
- customer: nombre del hospital/clínica
- city, country
- equipment: lista de equipos vistos
  - modality: MR, CT, Ultrasound, X-Ray, Patient Monitoring, Image Guided Therapy
- missing_required: campos que faltan. Requeridos: customer, ciudad o país, al menos un equipo con modality y quantity.
- follow_up_question: pregunta corta sobre el dato más importante que falta, o null si todo está completo
- ready_to_save: true solo si missing_required está vacío

Vas a recibir la conversación turno por turno. En cada turno tu JSON debe
acumular TODO lo que se sabe hasta ahora, no solo el último mensaje del
usuario -- si ya habías extraído un dato en un turno anterior y el usuario
no lo contradice, mantenlo.

IMPORTANTE -- nunca inventes datos que el usuario no dijo:
- Si el mensaje es un saludo, una pregunta, o no describe una visita real
  (ej. "hola", "buenas", "¿cómo estás?"), NO inventes customer ni equipment
  -- déjalos null/vacío, missing_required debe incluir "customer",
  ready_to_save false, y follow_up_question debe pedir que describa la
  visita (hospital y equipos vistos).
- country: déjalo null si el usuario no lo menciona explícitamente. NO
  adivines un país por el nombre del hospital, la marca del equipo, ni
  ninguna otra pista indirecta.
- brand: déjalo null si el usuario no dice una marca explícitamente. Un
  número/código de modelo (ej. "R25") NO implica ninguna marca -- nunca
  asocies un modelo a una marca que el usuario no dijo.
- modality: usa exactamente lo que el usuario describe. Un código de
  modelo por sí solo (ej. "R25") no te dice la modalidad -- si no la sabes,
  pon el valor más cercano posible pero agrega una nota a missing_required
  y pide confirmación en follow_up_question. No elijas una modalidad al
  azar solo para completar el campo.
- Si el usuario repite o corrige un dato, ese dato nuevo reemplaza al
  anterior; no mezcles ambos ni inventes un tercer valor.

Ejemplo:
Input: "Estuve en Hospital La Paz en Madrid, tienen 2 resonadores Philips Ingenia de unos 8 años"
JSON: {"customer":"Hospital La Paz","city":"Madrid","country":"Spain","equipment":[{"modality":"MR","quantity":2,"brand":"Philips","model":"Ingenia","approx_age_years":8,"confidence":"high","status":"reported"}],"missing_required":[],"follow_up_question":null,"ready_to_save":true}`;

// Applied as a GBNF grammar constraint on the model's own output (llama.cpp,
// via QVAC's `responseFormat: json_schema`) -- the model literally cannot
// emit tokens outside this shape, unlike prompt-only instructions which a
// small on-device model (Llama 3.2 1B here) frequently ignores or truncates.
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    customer: { type: ['string', 'null'] },
    city: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    equipment: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          modality: {
            type: 'string',
            enum: ['MR', 'CT', 'Ultrasound', 'X-Ray', 'Patient Monitoring', 'Image Guided Therapy'],
          },
          quantity: { type: ['integer', 'null'] },
          brand: { type: ['string', 'null'] },
          model: { type: ['string', 'null'] },
          approx_age_years: { type: ['number', 'null'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          status: { type: 'string', enum: ['reported', 'estimated', 'unknown'] },
        },
        required: ['modality', 'quantity', 'brand', 'model', 'approx_age_years', 'confidence', 'status'],
        additionalProperties: false,
      },
    },
    missing_required: { type: 'array', items: { type: 'string' } },
    follow_up_question: { type: ['string', 'null'] },
    ready_to_save: { type: 'boolean' },
  },
  required: ['customer', 'city', 'country', 'equipment', 'missing_required', 'follow_up_question', 'ready_to_save'],
  additionalProperties: false,
} as const;

export interface ExtractionResult {
  customer: string | null;
  city: string | null;
  country: string | null;
  equipment: EquipmentItem[];
  missing_required: string[];
  follow_up_question: string | null;
  ready_to_save: boolean;
}

export interface EquipmentItem {
  modality: string;
  quantity: number | null;
  brand: string | null;
  model: string | null;
  approx_age_years: number | null;
  confidence: string;
  status: string;
}

const FALLBACK: ExtractionResult = {
  customer: null,
  city: null,
  country: null,
  equipment: [],
  missing_required: ['customer'],
  follow_up_question: 'No pude entender el mensaje. ¿Puedes describir qué hospital visitaste y qué equipos viste?',
  ready_to_save: false,
};

function parseJSON(raw: string): ExtractionResult {
  // Grammar-constrained output is already a single JSON object with no
  // wrapping prose, but a defensive regex costs nothing if a model ever
  // emits e.g. a trailing newline or stray token around it.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { ...FALLBACK };
  try {
    const parsed = JSON.parse(match[0]);
    return {
      customer: parsed.customer ?? null,
      city: parsed.city ?? null,
      country: parsed.country ?? null,
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
      missing_required: Array.isArray(parsed.missing_required) ? parsed.missing_required : [],
      follow_up_question: parsed.follow_up_question ?? null,
      ready_to_save: Boolean(parsed.ready_to_save),
    };
  } catch {
    return { ...FALLBACK };
  }
}

export function startConversation(): ConversationTurn[] {
  return [{ role: 'system', content: SYSTEM_INSTRUCTIONS }];
}

function normalize(s: string): string {
  // NFD splits accented letters into base + combining mark, so stripping
  // U+0300-U+036F (combining diacritical marks) gives an accent-insensitive
  // compare -- "República" and "republica" match.
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * True if `value` plausibly came from something the user actually typed,
 * not purely from the model's imagination. Checked word-by-word (>=3 chars)
 * rather than as one phrase, since the user might phrase a name slightly
 * differently than the model normalizes it -- but every real invented value
 * we hit in testing (a fabricated customer from a bare "hola", a fabricated
 * brand from a bare model number) shared zero words with the actual input,
 * so this catches those without being so strict it rejects real answers.
 */
function groundedInText(value: string, rawText: string): boolean {
  const haystack = normalize(rawText);
  const words = normalize(value).split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return haystack.includes(normalize(value));
  return words.some((w) => haystack.includes(w));
}

/**
 * Code-level backstop, not just a prompt request: nulls out any
 * customer/brand/model the model claimed that doesn't actually appear
 * anywhere in what the technician typed this session. A prompt instruction
 * is something a small model can and does ignore; this can't be ignored,
 * because it never depends on the model's cooperation in the first place.
 * Nulling a field also forces ready_to_save false and adds a follow-up, so
 * a stripped hallucination becomes a real clarifying question instead of a
 * silently incomplete record.
 */
function groundResult(result: ExtractionResult, userTexts: string): ExtractionResult {
  let strippedSomething = false;
  const missing = [...result.missing_required];

  if (result.customer && !groundedInText(result.customer, userTexts)) {
    result.customer = null;
    if (!missing.includes('customer')) missing.push('customer');
    strippedSomething = true;
  }

  for (const item of result.equipment) {
    if (item.brand && !groundedInText(item.brand, userTexts)) {
      item.brand = null;
      strippedSomething = true;
    }
    if (item.model && !groundedInText(item.model, userTexts)) {
      item.model = null;
      strippedSomething = true;
    }
  }

  if (!strippedSomething) return result;
  return {
    ...result,
    missing_required: missing,
    ready_to_save: false,
    follow_up_question:
      result.follow_up_question ??
      'No reconozco ese dato en lo que describiste -- ¿puedes confirmarlo? (cliente, marca o modelo)',
  };
}

/**
 * Extends `history` with the user's new message, runs the extraction, and
 * returns the updated history (including the model's reply) alongside the
 * parsed result. Callers must persist and pass back the returned history on
 * the next call -- with kvCache on, re-sending the same prefix verbatim is
 * what lets QVAC skip reprocessing everything except the new message,
 * instead of re-running the whole conversation from scratch every turn.
 */
export async function extractFromTranscript(
  modelId: string,
  history: ConversationTurn[],
  userText: string
): Promise<{ result: ExtractionResult; history: ConversationTurn[] }> {
  const withUser: ConversationTurn[] = [...history, { role: 'user', content: userText }];
  const outcome = await runCompletion(modelId, withUser, {
    type: 'json_schema',
    json_schema: { name: 'extraction', schema: EXTRACTION_SCHEMA },
  });
  const parsed = parseJSON(outcome.text);
  // Checked against every user turn so far, not just this message -- a
  // customer/brand/model confirmed in an earlier turn and just carried
  // forward must not get stripped just because it isn't in *this* message.
  const userTexts = withUser.filter((t) => t.role === 'user').map((t) => t.content).join(' ');
  const result = groundResult(parsed, userTexts);
  const assistantContent = outcome.cacheableAssistantContent ?? outcome.text;
  return { result, history: [...withUser, { role: 'assistant', content: assistantContent }] };
}

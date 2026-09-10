import { runCompletion, type ConversationTurn } from './models';
import { getServerUrl } from '../config/serverConfig';

const SYSTEM_INSTRUCTIONS = `Extraes datos estructurados de observaciones de equipos médicos de visitas a hospitales.

Extrae cuando esté disponible:
- customer: nombre del hospital/clínica
- city, country
- equipment: lista de equipos vistos
  - modality: MR, CT, Ultrasound, X-Ray, Patient Monitoring, Image Guided Therapy
- missing_required: cuáles de estos tres faltan -- "customer" (no sabes el
  hospital/cliente), "location" (no sabes ciudad ni país), "equipment" (no
  hay ningún equipo con modality y quantity). Solo estos tres valores.
- ready_to_save: true solo si missing_required está vacío

Vas a recibir la conversación turno por turno. En cada turno tu JSON debe
acumular TODO lo que se sabe hasta ahora, no solo el último mensaje del
usuario -- si ya habías extraído un dato en un turno anterior y el usuario
no lo contradice, mantenlo.

IMPORTANTE -- nunca inventes datos que el usuario no dijo:
- Si el mensaje es un saludo, una pregunta, o no describe una visita real
  (ej. "hola", "buenas", "¿cómo estás?"), NO inventes customer ni equipment
  -- déjalos null/vacío y missing_required debe incluir "customer".
- country: déjalo null si el usuario no lo menciona explícitamente. NO
  adivines un país por el nombre del hospital, la marca del equipo, ni
  ninguna otra pista indirecta.
- brand: déjalo null si el usuario no dice una marca explícitamente. Un
  número/código de modelo (ej. "R25") NO implica ninguna marca -- nunca
  asocies un modelo a una marca que el usuario no dijo.
- modality: usa exactamente lo que el usuario describe. Un código de
  modelo por sí solo (ej. "R25") no te dice la modalidad -- si no la sabes,
  pon el valor más cercano posible pero agrega "equipment" a
  missing_required. No elijas una modalidad al azar solo para completar
  el campo.
- Si el usuario repite o corrige un dato, ese dato nuevo reemplaza al
  anterior; no mezcles ambos ni inventes un tercer valor.

No generes follow_up_question -- siempre pon null ahí, el texto que ve el
usuario se arma aparte a partir de missing_required.

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
    missing_required: {
      type: 'array',
      items: { type: 'string', enum: ['customer', 'location', 'equipment'] },
    },
    // Grammar-forced null, not just prompt-requested: the model's own
    // phrasing here drifted into nonsense unrelated to the app (once asked
    // about "exam results"). The real question shown to the technician is
    // built deterministically from missing_required instead -- see
    // buildFollowUpQuestion below. This also trims generation length, since
    // the model no longer spends tokens composing prose it can't use.
    follow_up_question: { type: 'null' },
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

const FOLLOW_UP_BY_FIELD: Record<string, string> = {
  customer: '¿Qué hospital o cliente visitaste?',
  location: '¿En qué ciudad o país fue la visita?',
  equipment: '¿Qué equipo viste (tipo y cuántas unidades)?',
};

/**
 * Deterministic, not generated: the model's own free-text phrasing for
 * this drifted into nonsense unrelated to the app (asked once about "exam
 * results" out of nowhere). missing_required is a closed enum we control,
 * so the question shown to the technician is always one of these three,
 * picked in a fixed priority order -- never the model's own words.
 */
function buildFollowUpQuestion(missing: string[]): string {
  for (const field of ['customer', 'location', 'equipment']) {
    if (missing.includes(field)) return FOLLOW_UP_BY_FIELD[field];
  }
  return '¿Puedes darme más detalles sobre la visita?';
}

/**
 * Code-level backstop, not just a prompt request: nulls out any
 * customer/brand/model the model claimed that doesn't actually appear
 * anywhere in what the technician typed this session. A prompt instruction
 * is something a small model can and does ignore; this can't be ignored,
 * because it never depends on the model's cooperation in the first place.
 * Nulling a field also forces ready_to_save false, and follow_up_question
 * is always rebuilt from missing_required regardless (see above).
 */
function groundResult(result: ExtractionResult, userTexts: string): ExtractionResult {
  const missing = [...result.missing_required];
  let customerStrippedNew = false;

  if (result.customer && !groundedInText(result.customer, userTexts)) {
    result.customer = null;
    if (!missing.includes('customer')) {
      missing.push('customer');
      customerStrippedNew = true;
    }
  }

  // brand/model are extra detail, not part of missing_required's gate --
  // nulling a fabricated one doesn't block saving, the review card will
  // just show it blank and the technician can add it via a correction.
  for (const item of result.equipment) {
    if (item.brand && !groundedInText(item.brand, userTexts)) item.brand = null;
    if (item.model && !groundedInText(item.model, userTexts)) item.model = null;
  }

  const readyToSave = result.ready_to_save && !customerStrippedNew;
  return {
    ...result,
    missing_required: missing,
    ready_to_save: readyToSave,
    follow_up_question: readyToSave ? null : buildFollowUpQuestion(missing),
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

/**
 * Same contract as extractFromTranscript, but the actual inference runs on
 * the mesh's main node (POST /extract on services/installed-base) instead
 * of on-device -- whatever model the Router has registered for
 * "completion" answers, which can be a lot bigger than what the phone can
 * run. Returns null on any failure (unreachable server, timeout, non-2xx,
 * offline token) so the caller can fall back to on-device without special-
 * casing the error. The same groundResult check runs regardless of source:
 * the backend's extraction is prompt-based, not grammar-constrained (see
 * services/installed-base/app/extraction.py), so it's less trustworthy on
 * its own than the on-device grammar-constrained path, not more.
 */
export async function extractFromTranscriptRemote(
  token: string,
  history: ConversationTurn[],
  userText: string
): Promise<{ result: ExtractionResult; history: ConversationTurn[] } | null> {
  const server = await getServerUrl();
  if (!server) return null;

  const withUser: ConversationTurn[] = [...history, { role: 'user', content: userText }];
  const transcript = withUser.filter((t) => t.role === 'user').map((t) => t.content);

  let raw: any;
  try {
    const resp = await fetch(`${server}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ transcript }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) return null;
    raw = await resp.json();
  } catch {
    return null;
  }

  const parsed: ExtractionResult = {
    customer: raw.customer ?? null,
    city: raw.city ?? null,
    country: raw.country ?? null,
    equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
    missing_required: Array.isArray(raw.missing_required) ? raw.missing_required : [],
    follow_up_question: null,
    ready_to_save: Boolean(raw.ready_to_save),
  };
  const result = groundResult(parsed, transcript.join(' '));
  // Recorded as a synthetic assistant turn in the same JSON shape the
  // on-device model would have produced, so history stays continuable if a
  // later turn in this same session falls back to on-device (server drops
  // mid-conversation) -- the local model just sees a prior JSON reply, same
  // as if it had written it itself.
  const assistantContent = JSON.stringify(parsed);
  return { result, history: [...withUser, { role: 'assistant', content: assistantContent }] };
}

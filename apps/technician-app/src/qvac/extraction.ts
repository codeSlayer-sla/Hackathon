import { runCompletion } from './models';

const INSTRUCTIONS = `Extraes datos estructurados de observaciones de equipos médicos de visitas a hospitales.

Extrae cuando esté disponible:
- customer: nombre del hospital/clínica
- city, country
- equipment: lista de equipos vistos
  - modality: MR, CT, Ultrasound, X-Ray, Patient Monitoring, Image Guided Therapy
- missing_required: campos que faltan. Requeridos: customer, ciudad o país, al menos un equipo con modality y quantity.
- follow_up_question: pregunta corta sobre el dato más importante que falta, o null si todo está completo
- ready_to_save: true solo si missing_required está vacío

Ejemplo:
Input: "Estuve en Hospital La Paz en Madrid, tienen 2 resonadores Philips Ingenia de unos 8 años"
JSON: {"customer":"Hospital La Paz","city":"Madrid","country":"Spain","equipment":[{"modality":"MR","quantity":2,"brand":"Philips","model":"Ingenia","approx_age_years":8,"confidence":"high","status":"reported"}],"missing_required":[],"follow_up_question":null,"ready_to_save":true}

Conversación (más reciente al final):
`;

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

export async function extractFromTranscript(
  modelId: string,
  transcript: string[]
): Promise<ExtractionResult> {
  const convo = transcript.map((t) => `Usuario: ${t}`).join('\n');
  const prompt = `${INSTRUCTIONS}${convo}\nJSON:`;
  const answer = await runCompletion(modelId, prompt, {
    type: 'json_schema',
    json_schema: { name: 'extraction', schema: EXTRACTION_SCHEMA },
  });
  return parseJSON(answer);
}

import { runCompletion } from './models';

const INSTRUCTIONS = `Extraes datos estructurados de observaciones de equipos médicos de visitas a hospitales.

Extrae cuando esté disponible:
- customer: nombre del hospital/clínica
- city, country
- equipment: lista de {"modality", "quantity", "brand", "model", "approx_age_years", "confidence", "status"}
  - modality: MR, CT, Ultrasound, X-Ray, Patient Monitoring, Image Guided Therapy
  - confidence: "high" | "medium" | "low"
  - status: "reported" | "estimated" | "unknown"
- missing_required: campos que faltan. Requeridos: customer, ciudad o país, al menos un equipo con modality y quantity.
- follow_up_question: pregunta corta sobre el dato más importante que falta, o null si todo está completo
- ready_to_save: true solo si missing_required está vacío

Responde SOLO con un objeto JSON, sin prosa ni markdown:
{"customer": string|null, "city": string|null, "country": string|null, "equipment": [...], "missing_required": [...], "follow_up_question": string|null, "ready_to_save": boolean}

Ejemplo:
Input: "Estuve en Hospital La Paz en Madrid, tienen 2 resonadores Philips Ingenia de unos 8 años"
JSON: {"customer":"Hospital La Paz","city":"Madrid","country":"Spain","equipment":[{"modality":"MR","quantity":2,"brand":"Philips","model":"Ingenia","approx_age_years":8,"confidence":"high","status":"reported"}],"missing_required":[],"follow_up_question":null,"ready_to_save":true}

Conversación (más reciente al final):
`;

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
  const answer = await runCompletion(modelId, prompt);
  return parseJSON(answer);
}

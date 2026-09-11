/**
 * Deterministic phishing / fraud analyzer.
 *
 * This is the PRIMARY safety mechanism of CajaAI: the decision NEVER depends
 * on the LLM. The model may later explain a result, but the risk level and the
 * recommended action are always produced by these local rules.
 */

export type RiskLevel = "low" | "medium" | "high";

export interface AnalysisResult {
  riskLevel: RiskLevel;
  score: number;
  redFlags: string[];
  recommendedAction: string;
}

interface Rule {
  weight: number;
  patterns: RegExp[];
  label: string;
}

const urgencyRule: Rule = {
  weight: 1,
  label: "Lenguaje de urgencia o presión",
  patterns: [
    /urgente/i,
    /inmediatamente/i,
    /última oportunidad/i,
    /último aviso/i,
    /actúe ya/i,
    /hoy mismo/i,
    /48 horas/i,
    /24 horas/i,
    /inmediato/i,
    /ahora mismo/i,
  ],
};

const blockingRule: Rule = {
  weight: 2,
  label: "Amenaza de bloqueo, suspensión o cierre de la cuenta",
  patterns: [
    /cuenta será bloquead/i,
    /cuenta será suspendid/i,
    /cuenta será cerrad/i,
    /cuenta será desactivad/i,
    /será bloqueada/i,
    /será suspendida/i,
    /será cerrada/i,
    /congelada/i,
    /restringida/i,
  ],
};

const passwordRule: Rule = {
  weight: 2,
  label: "Solicitud de contraseña",
  patterns: [/contraseña/i, /password/i, /clave de acceso/i],
};

const pinRule: Rule = {
  weight: 2,
  label: "Solicitud de PIN o NIP",
  patterns: [/ pin\b/i, /pin de/i, / tu pin\b/i, /nip/i],
};

const codeRule: Rule = {
  weight: 2,
  label: "Solicitud de código de verificación o OTP",
  patterns: [
    /código de verificación/i,
    /codigo de verificacion/i,
    /código de seguridad/i,
    /codigo de seguridad/i,
    / otp\b/i,
    /código recibido/i,
    /codigo recibido/i,
  ],
};

const linkRule: Rule = {
  weight: 2,
  label: "Presencia de un enlace o invitación a hacer clic",
  patterns: [
    /https?:\/\//i,
    /www\./i,
    /ingrese al siguiente enlace/i,
    /siguiente enlace/i,
    /haz clic/i,
    /haga clic/i,
    /hacer clic/i,
    /\bclic\b/i,
    /\bbit\.ly\b/i,
    /desde este enlace/i,
  ],
};

const piiRule: Rule = {
  weight: 1,
  label: "Solicitud de información personal (cuenta, DNI, datos)",
  patterns: [
    /número de cuenta/i,
    /numero de cuenta/i,
    /datos personales/i,
    /datos de tu cuenta/i,
    /verificar tus datos/i,
    /verificar sus datos/i,
    /verifique tu información/i,
    /verifique su información/i,
    /\bdni\b/i,
    /cédula/i,
    /identificaci/i,
    /número de tarjeta/i,
    /numero de tarjeta/i,
    /usuario y contraseña/i,
  ],
};

const impersonationRule: Rule = {
  weight: 1,
  label: "Suplantación de identidad bancaria (posible)",
  patterns: [
    /su banco/i,
    /tu banco/i,
    /de nuestra entidad/i,
    /nuestro equipo de seguridad/i,
    /departamento de seguridad/i,
    /area de fraude/i,
    /su caja de ahorros/i,
    /su caja/i,
    /tu caja/i,
  ],
};

const rules: Rule[] = [
  urgencyRule,
  blockingRule,
  passwordRule,
  pinRule,
  codeRule,
  linkRule,
  piiRule,
  impersonationRule,
];

const HIGH_RISK_ACTION =
  "No hagas clic en enlaces ni compartas contraseñas, PIN o códigos. " +
  "Verifica el mensaje utilizando los canales oficiales de tu banco. " +
  "Si el mensaje parece venir de tu banco, contacta directamente a tu entidad por su línea oficial y reporta el mensaje como sospechoso.";

const MEDIUM_RISK_ACTION =
  "Ten precaución. No compartas contraseñas, PIN o códigos por ningún canal. " +
  "Verifica la información utilizando los canales oficiales de tu banco antes de actuar.";

const LOW_RISK_ACTION =
  "El mensaje no presenta indicadores claros de fraude. Aun así, nunca compartas contraseñas, PIN o códigos y verifica siempre por los canales oficiales.";

export function analyzeMessage(text: string): AnalysisResult {
  const input = text?.trim() ?? "";
  const redFlags: string[] = [];
  let score = 0;

  for (const rule of rules) {
    let matched = false;
    for (const pattern of rule.patterns) {
      if (pattern.test(input)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      redFlags.push(rule.label);
      score += rule.weight;
    }
  }

  const hasLink = redFlags.some((f) => f.toLowerCase().includes("enlace") || f.includes("https") || f.includes("clic"));
  const requestsCredential = redFlags.some(
    (f) =>
      f.includes("contraseña") ||
      f.toLowerCase().includes("pin") ||
      f.includes("código")
  );
  const threatensBlocking = redFlags.some((f) =>
    f.toLowerCase().includes("bloqueo")
  );

  let riskLevel: RiskLevel;
  if (
    score >= 5 ||
    (hasLink && requestsCredential) ||
    (hasLink && threatensBlocking) ||
    (requestsCredential && threatensBlocking) ||
    (requestsCredential && score >= 4)
  ) {
    riskLevel = "high";
  } else if (score >= 2) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  const recommendedAction =
    riskLevel === "high"
      ? HIGH_RISK_ACTION
      : riskLevel === "medium"
        ? MEDIUM_RISK_ACTION
        : LOW_RISK_ACTION;

  return { riskLevel, score, redFlags, recommendedAction };
}
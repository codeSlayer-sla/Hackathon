/**
 * Local banking knowledge base for CajaAI.
 *
 * This is a small, fully-offline, structured knowledge base that provides
 * CONCISE EDUCATIONAL CONTEXT for Qwen3 600M. It is NOT a replacement for
 * the LLM — Qwen3 still generates every answer dynamically. It is also NOT
 * official Caja de Ahorros policy; it is educational MVP material.
 *
 * Each entry exposes a `keywords` list consumed by the generic retriever in
 * `./knowledgeRetriever`.
 */

export interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  content: string;
}

export const KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: "savings-account",
    category: "cuentas",
    title: "Cuenta de ahorro",
    keywords: [
      "cuenta de ahorro",
      "cuenta de ahorros",
      "que es una cuenta",
      "ahorro",
      "ahorrar",
      "deposito",
      "depositos",
      "depositar",
      "retiro",
      "retirar",
      "interes",
    ],
    content: `Propósito: la cuenta de ahorro sirve para guardar dinero y generar interés. Está orientada a conservar tu dinero, no a hacer pagos frecuentes.

Depósitos y retiros: sueles poder depositar y retirar dinero, aunque puede haber límites operativos. No está pensada para el pago diario.

Interés: la institución reconoce un porcentaje anual sobre el saldo. Con interés compuesto, los intereses que recibes también generan interés, por lo que el saldo crece más rápido con el tiempo.

Consideraciones: antes de abrir una, revisa la tasa de interés, las comisiones, los requisitos mínimos y las condiciones de retiro.`,
  },
  {
    id: "checking-account",
    category: "cuentas",
    title: "Cuenta corriente",
    keywords: [
      "cuenta corriente",
      "cuenta de cheques",
      "corriente",
      "cheques",
      "transferencia",
      "transferir",
      "transacciones",
      "debito",
      "salario",
      "cobrar",
    ],
    content: `Propósito: la cuenta corriente (o de cheques) sirve para operar tu dinero en el día a día: cobrar salario, pagar servicios, hacer transferencias y recibir pagos.

Transacciones: depósitos, retiros, transferencias, pagos con débito y administración de cheques. Está pensada para movimientos frecuentes.

Diferencias con la cuenta de ahorro: la corriente prioriza la liquidez y la frecuencia de operaciones; la de ahorro prioriza conservar el dinero y generar interés. Para el día a día conviene la corriente; para metas de ahorro, la de ahorro.`,
  },
  {
    id: "savings-vs-checking",
    category: "cuentas",
    title: "Ahorro vs. corriente",
    keywords: [
      "diferencia",
      "diferencias",
      "compara",
      "comparacion",
      "cual es mejor",
      "cuenta de ahorro",
      "cuenta corriente",
      "ahorro y corriente",
      "ahorro o corriente",
      "diferencia entre ahorro y corriente",
    ],
    content: `Comparación de cuentas:
- La cuenta de ahorro está orientada a guardar dinero y generar interés; no es para pagos frecuentes.
- La cuenta corriente está orientada a las operaciones del día a día: cobrar, pagar y transferir.
- En general, la de ahorro tiende a ofrecer interés por tu saldo, mientras que la corriente da prioridad a la liquidez.
- La mejor opción depende de tu objetivo: para metas de ahorro, la de ahorro; para el día a día, la corriente.`,
  },
  {
    id: "saving-money",
    category: "ahorro",
    title: "Cómo ahorrar",
    keywords: [
      "ahorrar",
      "ahorro",
      "fondo de emergencia",
      "emergencia",
      "aportes",
      "aporte",
      "interes compuesto",
      "presupuesto",
      "presupuestar",
      "meta de ahorro",
      "metas",
      "empezar a ahorrar",
      "como ahorrar",
    ],
    content: `Fondo de emergencia: guarda suficiente dinero para cubrir entre 3 y 6 meses de gastos básicos ante imprevistos. Es la base de un buen ahorro.

Aportes regulares: aparta un porcentaje fijo apenas recibas tu ingreso, aunque sea pequeño. La constancia importa más que la cantidad.

Interés compuesto: es el interés que se calcula sobre el saldo acumulado (capital más intereses previos). Cuanto antes comiences y más tiempo dejes el dinero, más crece.

Presupuesto: registra tus ingresos y gastos, y aparta primero el ahorro: ingreso − ahorro = gasto disponible.`,
  },
  {
    id: "loans",
    category: "creditos",
    title: "Préstamos",
    keywords: [
      "prestamo",
      "prestamos",
      "credito",
      "creditos",
      "capital",
      "cuota",
      "cuotas",
      "plazo",
      "plazos",
      "reembolso",
      "interes",
      "deuda",
      "pedir prestado",
    ],
    content: `Conceptos básicos:
- Capital: la cantidad de dinero que pides prestada.
- Interés: el costo adicional por usar ese dinero.
- Cuotas o plazos: pagos periódicos que devuelven el capital más los intereses.
- Reembolso total: la suma de todas las cuotas; siempre supera el capital prestado.

Consejo: pide prestado de forma responsable: solo lo necesario, comparando costos totales y únicamente si puedes asumir las cuotas dentro de tu presupuesto.`,
  },
  {
    id: "fraud-phishing",
    category: "seguridad",
    title: "Fraude y phishing",
    keywords: [
      "phishing",
      "fraude",
      "fraudulento",
      "enlace",
      "enlaces",
      "vinculo",
      "vinculos",
      "contraseña",
      "contrasena",
      "pin",
      "codigo",
      "codigos",
      "codigo de seguridad",
      "seguridad",
      "robo de identidad",
      "estafa",
      "estafador",
      "ingenieria social",
      "spam",
      "cuenta bloqueada",
      "verificar cuenta",
      "mensaje sospechoso",
    ],
    content: `Señales de alerta:
- Enlaces o archivos sospechosos: no hagas clic en enlaces ni descargues archivos de remitentes desconocidos o mensajes no esperados.
- Petición de claves: una institución legítima nunca te pide tu contraseña, PIN o códigos de seguridad por mensaje, llamada o correo.
- Urgencia o presión: los estafadores generan urgencia o miedo ("tu cuenta será bloqueada") para que actúes rápido sin verificar.
- Ingeniería social: se hacen pasar por tu banco, familiares o empresas para obtener datos.

Qué hacer: no respondas, no compartas datos, no hagas clic, reporta el intento y contacta el canal oficial de tu banco para verificar.`,
  },
  {
    id: "financial-education",
    category: "educacion",
    title: "Educación financiera básica",
    keywords: [
      "educacion financiera",
      "finanzas",
      "financiero",
      "ingresos",
      "ingreso",
      "gastos",
      "gasto",
      "deuda",
      "deudas",
      "interes",
      "intereses",
      "presupuesto",
      "ahorro",
      "ahorrar",
      "invertir",
      "inversion",
    ],
    content: `Conceptos básicos de finanzas personales:
- Ingresos: el dinero que recibes (salario, ventas, rentas).
- Gastos: el dinero que usas para consumir o pagar obligaciones.
- Ahorro: la parte de tus ingresos que reservas para el futuro.
- Deuda: el dinero que debes a alguien; conlleva un costo de interés.
- Interés: el precio del dinero: es ingreso cuando ahorras o inviertes, y costo cuando obtienes deuda.

Regla práctica: primero aparta el ahorro y luego distribuye el resto en tus gastos.`,
  },
  {
    id: "disclaimer",
    category: "aviso",
    title: "Aviso CajaAI",
    keywords: [
      "oficial",
      "politica",
      "politicas",
      "caja de ahorros",
      "procedimiento",
      "procedimientos",
      "comision",
      "comisiones",
      "requisitos oficiales",
      "tasas oficiales",
      "reglas",
      "normas",
    ],
    content: `Aviso importante: esta es una aplicación educativa de prototipo de hackathon. CajaAI no representa ni posee autoridad para definir políticas oficiales de Caja de Ahorros.

- No se deben inventar comisiones, tasas, requisitos, procedimientos ni datos oficiales.
- Si el contexto local no contiene información oficial y verificada sobre un dato bancario concreto, lo correcto es decirlo claramente y sugerir consultar el canal oficial de la entidad.`,
  },
];

/**
 * Renders retrieved knowledge entries as a compact text block to be injected
 * into the system message before `completion()`. Returns an empty string
 * when there is nothing relevant, so the model gets no baseline context at all.
 */
export function formatKnowledgeContext(entries: readonly KnowledgeEntry[]): string {
  if (entries.length === 0) {
    return "";
  }
  const body = entries
    .map((entry) => `### ${entry.title}\n${entry.content}`)
    .join("\n\n");
  return `CONTEXTO LOCAL (material educativo de referencia; NO es política oficial):\n\n${body}`;
}
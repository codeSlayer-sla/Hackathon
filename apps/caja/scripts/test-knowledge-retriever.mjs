import assert from "node:assert/strict";
import { formatKnowledgeContext, KNOWLEDGE_BASE } from "../src/lib/knowledge.ts";
import { retrieveKnowledge } from "../src/lib/knowledgeRetriever.ts";

const ids = (entries) => entries.map((entry) => entry.id);

// --- 1. Savings question retrieves savings knowledge ---
let result = retrieveKnowledge(
  "¿Qué es una cuenta de ahorro?",
  KNOWLEDGE_BASE
);
assert.ok(
  ids(result).includes("savings-account"),
  "savings question must retrieve savings-account"
);

// --- 2. Checking question retrieves checking knowledge ---
result = retrieveKnowledge(
  "¿Qué es una cuenta corriente?",
  KNOWLEDGE_BASE
);
assert.ok(
  ids(result).includes("checking-account"),
  "checking question must retrieve checking-account"
);

// --- 3. Savings vs checking retrieves both + comparison ---
result = retrieveKnowledge(
  "¿Cuál es la diferencia entre una cuenta de ahorro y una cuenta corriente?",
  KNOWLEDGE_BASE
);
const diffIds = ids(result);
assert.ok(
  diffIds.includes("savings-vs-checking"),
  "comparison question must retrieve savings-vs-checking"
);
assert.ok(
  diffIds.includes("savings-account"),
  "comparison question must retrieve savings-account"
);
assert.ok(
  diffIds.includes("checking-account"),
  "comparison question must retrieve checking-account"
);
assert.equal(
  result[0].id,
  "savings-vs-checking",
  "comparison must rank first for a difference question"
);

// --- 4. Loan question retrieves loan knowledge ---
result = retrieveKnowledge(
  "¿Cómo funcionan los préstamos?",
  KNOWLEDGE_BASE
);
assert.ok(
  ids(result).includes("loans"),
  "loan question must retrieve loans"
);

// --- 5. Phishing question retrieves fraud/phishing knowledge ---
result = retrieveKnowledge(
  "¿Qué hago si recibo un mensaje de phishing con un enlace sospechoso?",
  KNOWLEDGE_BASE
);
assert.ok(
  ids(result).includes("fraud-phishing"),
  "phishing question must retrieve fraud-phishing"
);

// --- 6. Unrelated question returns empty context ---
result = retrieveKnowledge(
  "¿Qué le gusta comer a los gatos?",
  KNOWLEDGE_BASE
);
assert.equal(result.length, 0, "unrelated question must return no context");

// --- 7. Empty / whitespace input never crashes and returns empty ---
result = retrieveKnowledge("", KNOWLEDGE_BASE);
assert.equal(result.length, 0, "empty input must return empty");

result = retrieveKnowledge("   \n\t  ", KNOWLEDGE_BASE);
assert.equal(result.length, 0, "whitespace input must return empty");

// --- maxResults is honored ---
result = retrieveKnowledge(
  "¿Qué es una cuenta de ahorro?",
  KNOWLEDGE_BASE,
  { maxResults: 1 }
);
assert.equal(result.length, 1, "maxResults must cap the returned entries");

// --- formatKnowledgeContext is empty for no entries, non-empty otherwise ---
assert.equal(formatKnowledgeContext([]), "");
const ctx = formatKnowledgeContext(
  retrieveKnowledge("¿Qué es un préstamo?", KNOWLEDGE_BASE)
);
assert.ok(ctx.length > 0, "context should be non-empty when entries exist");
assert.match(ctx, /CONTEXTO LOCAL/, "context block must be labeled");

console.log("KNOWLEDGE_RETRIEVER TESTS OK");
import assert from "node:assert/strict";
import { cleanResponse } from "../src/lib/responseCleaner.ts";

// --- closed think block ---
assert.equal(
  cleanResponse(
    "<think>\nEl usuario pregunta sobre ahorros.\nDebo responder con un ejemplo.\n</think>Una cuenta de ahorro es un producto bancario."
  ),
  "Una cuenta de ahorro es un producto bancario."
);

// --- multiple think blocks ---
assert.equal(
  cleanResponse(
    "<think>razonamiento1</think>respuesta1 <think>razonamiento2</think>respuesta2"
  ),
  "respuesta1 respuesta2"
);

// --- unclosed trailing think (stop token mid-thought) ---
assert.equal(
  cleanResponse("<think>estoy pensando en cómo responder esto"),
  ""
);

// --- closed think block only (no visible content after) ---
assert.equal(
  cleanResponse("<think>pensando...</think>"),
  ""
);

// --- unclosed think alone (no close tag) ---
assert.equal(
  cleanResponse("<think>pensando..."),
  ""
);

// --- case-insensitive variant (<Think>) ---
assert.equal(
  cleanResponse(
    "<Think>\nRazonamiento interno.\n</think>\nRespuesta visible."
  ),
  "Respuesta visible."
);

// --- no think tags at all (passthrough) ---
assert.equal(
  cleanResponse("Una respuesta limpia sin bloques de razonamiento."),
  "Una respuesta limpia sin bloques de razonamiento."
);

// --- empty string ---
assert.equal(cleanResponse(""), "");

// --- only whitespace ---
assert.equal(cleanResponse("   \n\t  "), "");

// --- only think block, no visible content ---
assert.equal(
  cleanResponse("<think>todo es razonamiento interno</think>"),
  ""
);

// --- think block with newlines inside ---
assert.equal(
  cleanResponse(
    "<think>Paso 1: analizar.\nPaso 2: decidir.\n\nPaso 3: responder.</think>Aquí está tu respuesta."
  ),
  "Aquí está tu respuesta."
);

// --- leading/trailing whitespace trimmed ---
assert.equal(
  cleanResponse("  <think>x</think>  resultado  "),
  "resultado"
);

// --- real-world Qwen3 output pattern ---
assert.equal(
  cleanResponse(
    "<think>El usuario quiere saber cuánto ahorrar.\nVoy a recomendar el 10% de sus ingresos.\n</think>Te recomiendo apartar al menos el 10% de tus ingresos mensuales."
  ),
  "Te recomiendo apartar al menos el 10% de tus ingresos mensuales."
);

// --- think block with response and trailing unclosed think (edge case) ---
assert.equal(
  cleanResponse("<think>primer razonamiento</think>respuesta visible <think>segundo razonamiento incompleto"),
  "respuesta visible"
);

console.log("RESPONSE_CLEANER TESTS OK");

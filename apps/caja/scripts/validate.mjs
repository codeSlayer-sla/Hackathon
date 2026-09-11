import assert from "node:assert/strict";
import { analyzeMessage } from "../src/lib/security.ts";
import { simulateSavings } from "../src/lib/simulator.ts";

assert.equal(analyzeMessage("").riskLevel, "low");

const phishing = analyzeMessage(
  "Su cuenta será bloqueada. Ingrese al siguiente enlace para verificar sus datos."
);
assert.equal(phishing.riskLevel, "high", "phishing must be HIGH");
assert.ok(
  phishing.redFlags.length >= 3,
  "phishing should surface multiple red flags"
);
assert.match(
  phishing.recommendedAction,
  /No hagas clic en enlaces ni compartas contraseña/i,
  "HIGH risk must give the strong safe recommendation"
);

const creds = analyzeMessage(
  "Urgente: confirma tu PIN y tu contraseña para evitar que tu cuenta sea suspendida hoy mismo."
);
assert.equal(creds.riskLevel, "high");
assert.match(creds.recommendedAction, /No hagas clic/);

const normal = analyzeMessage(
  "Su estado de cuenta de junio ya está disponible en la aplicación."
);
assert.equal(normal.riskLevel, "low", "normal banking message must be LOW");
assert.ok(normal.redFlags.length === 0);

const mixed = analyzeMessage(
  "Recuerde actualizar su información bancaria para seguir operando normalmente."
);
assert.ok(
  ["low", "medium"].includes(mixed.riskLevel),
  "soft PII request must be LOW/MEDIUM, never HIGH"
);
assert.ok(mixed.riskLevel !== "high");

const sim = simulateSavings({
  initialAmount: 1000,
  monthlyContribution: 100,
  annualRatePercent: 12,
  months: 12,
});
assert.equal(sim.totalContributions, 2200);
assert.ok(Math.abs(sim.finalBalance - 2395.08) < 0.01);
assert.ok(Math.abs(sim.estimatedInterest - 195.08) < 0.01);
assert.equal(sim.months, 12);

const zero = simulateSavings({
  initialAmount: 0,
  monthlyContribution: 0,
  annualRatePercent: 5,
  months: 12,
});
assert.equal(zero.totalContributions, 0);
assert.equal(zero.estimatedInterest, 0);
assert.equal(zero.finalBalance, 0);

const badInput = simulateSavings({ initialAmount: -5, monthlyContribution: -1, annualRatePercent: -3, months: 0 });
assert.equal(badInput.totalContributions, 0);
assert.equal(badInput.months, 1);

console.log(
  JSON.stringify(
    {
      phishing: { risk: phishing.riskLevel, flags: phishing.redFlags.length },
      normal: normal.riskLevel,
      simulator: { contributions: sim.totalContributions, interest: sim.estimatedInterest, balance: sim.finalBalance },
    },
    null,
    2
  )
);
console.log("VALIDATION OK");
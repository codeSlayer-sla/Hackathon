/**
 * Deterministic savings simulator. Pure TypeScript, fully local, no AI.
 *
 * Educational only — the result is an estimate and does not constitute
 * financial advice.
 */

export interface SavingsInput {
  initialAmount: number;
  monthlyContribution: number;
  annualRatePercent: number;
  months: number;
}

export interface SavingsResult {
  monthlyRatePercent: number;
  totalContributions: number;
  estimatedInterest: number;
  finalBalance: number;
  months: number;
}

export function simulateSavings(input: SavingsInput): SavingsResult {
  const initialAmount = Math.max(0, input.initialAmount || 0);
  const monthlyContribution = Math.max(0, input.monthlyContribution || 0);
  const annualRatePercent = Math.max(0, input.annualRatePercent || 0);
  const months = Math.max(1, Math.floor(input.months || 0));

  const monthlyRate = annualRatePercent / 100 / 12;

  let balance = initialAmount;
  for (let m = 0; m < months; m++) {
    const interest = balance * monthlyRate;
    balance += interest + monthlyContribution;
  }

  const totalContributions = initialAmount + monthlyContribution * months;
  const estimatedInterest = balance - totalContributions;

  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    monthlyRatePercent: round(monthlyRate * 100),
    totalContributions: round(totalContributions),
    estimatedInterest: round(estimatedInterest),
    finalBalance: round(balance),
    months,
  };
}
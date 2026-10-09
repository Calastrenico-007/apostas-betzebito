export interface BetRules {
  tax_percent: number;
  multiple_bonus_min_selections: number;
  multiple_bonus_percent: number;
}

export function parseBetRules(payload: unknown): BetRules | null {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== 'object') return null;

  const values = row as Record<string, unknown>;
  const taxPercent = Number(values.tax_percent);
  const bonusMinSelections = Number(values.multiple_bonus_min_selections);
  const bonusPercent = Number(values.multiple_bonus_percent);

  if (
    !Number.isFinite(taxPercent) ||
    !Number.isInteger(bonusMinSelections) ||
    !Number.isFinite(bonusPercent) ||
    taxPercent < 0 ||
    taxPercent > 100 ||
    bonusMinSelections < 2 ||
    bonusMinSelections > 15 ||
    bonusPercent < 0 ||
    bonusPercent > 100
  ) {
    return null;
  }

  return {
    tax_percent: taxPercent,
    multiple_bonus_min_selections: bonusMinSelections,
    multiple_bonus_percent: bonusPercent,
  };
}

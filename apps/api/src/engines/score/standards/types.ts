// Country Nutrition Standard types — Phase 4.
// All threshold values are per 100g of food.
// CRITICAL: These types govern pure scoring functions only. LLM writes to any
//   score/band field remain prohibited (enforced by scripts/audit-llm-writes.ts).

export interface NegativeNutrientThresholds {
  veryLow: number;
  low: number;
  moderate: number;
  high: number;
  veryHigh: number;
}

// Trans fat uses its own bucketing (few countries declare it clearly).
export interface TransFatThresholds {
  none: number;
  trace: number;
  low: number;
  high: number;
}

// Positive nutrients use the same five-bracket shape.
export type PositiveNutrientThresholds = NegativeNutrientThresholds;

export interface NutrientThresholdPack {
  sodium: NegativeNutrientThresholds;
  sugar: NegativeNutrientThresholds;
  satFat: NegativeNutrientThresholds;
  transFat: TransFatThresholds;
  fibre: PositiveNutrientThresholds;
  protein: PositiveNutrientThresholds;
}

export interface ScoringWeights {
  sodium:   number;
  sugar:    number;
  satFat:   number;
  transFat: number;
  fibre:    number;
  protein:  number;
  nova:     number;
}

// Primary nutrition standard descriptor for a country or region.
export interface CountryNutritionStandard {
  /** DB primary key, e.g. 'icmr_nin_2020'. */
  id: string;
  displayName: string;
  authority: string;
  version: string;
  /** ISO-3166 codes for which this standard is authoritative. */
  isoCountryCodes: string[];
  thresholds: NutrientThresholdPack;
  weights: ScoringWeights;
}

// Verify weights sum to 1.0 at compile-time via type test (runtime check in registry).
export function assertWeightsSum(w: ScoringWeights, id: string): void {
  const sum = w.sodium + w.sugar + w.satFat + w.transFat + w.fibre + w.protein + w.nova;
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`[NutritionStandard] weights for '${id}' sum to ${sum.toFixed(4)}, expected 1.0`);
  }
}

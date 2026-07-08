// Australia / New Zealand Nutrition Standard — NHMRC Australian Dietary Guidelines +
// FSANZ Health Star Rating (HSR) System Implementation Guide general consumer thresholds
// (sodium <120mg/100g "best", <400mg/100g "good"; saturated fat <3g/100g "best";
// sugars <15g/100g general target — HSR's full baseline-points algorithm is category- and
// energy-density-specific and not reducible to a single per-100g table; these are the
// HSR program's own published simplified consumer guidance figures). Fibre/protein claim
// levels follow FSANZ Food Standards Code Standard 1.2.7, aligned with Codex CAC/GL 23-1997.

import type { CountryNutritionStandard } from './types.js';

export const AU_STANDARD: CountryNutritionStandard = {
  id: 'nhmrc_hsr_2024',
  displayName: 'Australia / New Zealand — NHMRC + Health Star Rating',
  authority: 'NHMRC / FSANZ',
  version: '2024',
  isoCountryCodes: ['AU'],
  thresholds: {
    sodium:  { veryLow: 120, low: 230, moderate: 400, high: 600, veryHigh: 900 },
    sugar:   { veryLow: 5,   low: 10,  moderate: 15,  high: 22.5, veryHigh: 30 },
    satFat:  { veryLow: 1.5, low: 3.0, moderate: 5.0, high: 7.5,  veryHigh: 10.0 },
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },
    fibre:   { veryLow: 0.0, low: 0.9, moderate: 3.0, high: 6.0, veryHigh: 9.0 },
    protein: { veryLow: 1.6, low: 3.2, moderate: 6.0, high: 12.0, veryHigh: 20.0 },
  },
  weights: {
    sodium:   0.20,  // NHMRC: hypertension/CVD is the leading Australian NCD burden
    sugar:    0.15,
    satFat:   0.20,  // HSR's saturated-fat component is the strongest single driver of star deductions
    transFat: 0.10,
    fibre:    0.15,
    protein:  0.10,
    nova:     0.10,
  },
};

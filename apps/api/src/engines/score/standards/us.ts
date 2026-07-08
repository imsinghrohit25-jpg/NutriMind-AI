// United States / Canada Nutrition Standard — FDA Nutrition Facts Daily Values (21 CFR 101.9,
// 2020 final rule) + USDA Dietary Guidelines for Americans 2025-2030.
// Thresholds are derived from FDA %DV bands (≤5%DV = "low", ≥20%DV = "high"; scaled per
// 100g as a practical proxy — official %DV claims are per-RACC serving, not per-100g;
// see ADR-0017 for the approximation rationale) applied to the published Daily Values:
// sodium 2300mg, saturated fat 20g, added sugars 50g, dietary fiber 28g, protein 50g.

import type { CountryNutritionStandard } from './types.js';

export const US_STANDARD: CountryNutritionStandard = {
  id: 'us_dri_2020',
  displayName: 'United States / Canada — FDA Daily Values 2020',
  authority: 'FDA / USDA',
  version: '2020',
  isoCountryCodes: ['US', 'CA'],
  thresholds: {
    sodium:  { veryLow: 115,  low: 230,  moderate: 460, high: 690, veryHigh: 920 },   // %DV of 2300mg: 5/10/20/30/40
    sugar:   { veryLow: 2.5,  low: 5,    moderate: 10,  high: 15,  veryHigh: 20 },     // %DV of added-sugar DV 50g
    satFat:  { veryLow: 1.0,  low: 2.0,  moderate: 4.0, high: 6.0, veryHigh: 8.0 },    // %DV of 20g
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },                          // no FDA trans-fat DV; WHO elimination target used
    fibre:   { veryLow: 1.4,  low: 2.8,  moderate: 5.6, high: 8.4, veryHigh: 11.2 },  // %DV of 28g: 5/10/20/30/40
    protein: { veryLow: 2.5,  low: 5.0,  moderate: 10.0, high: 15.0, veryHigh: 20.0 },// %DV of 50g
  },
  weights: {
    sodium:   0.20,  // AHA/CDC hypertension prevention priority
    sugar:    0.20,  // Dietary Guidelines 2025-2030: added sugar <10% energy
    satFat:   0.15,  // Dietary Guidelines: saturated fat <10% energy
    transFat: 0.10,  // FDA PHVO ban (2018) — trans fat elimination target
    fibre:    0.15,  // Fiber is a documented "nutrient of public health concern" (underconsumed)
    protein:  0.10,  // DRI adequacy, not a priority nutrient of concern
    nova:     0.10,  // NOVA ultra-processing signal
  },
};

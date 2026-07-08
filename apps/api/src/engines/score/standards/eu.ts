// European Union Nutrition Standard — Nutri-Score 2023 algorithm (Santé Publique France /
// European Nutri-Score Coordination Committee) + EFSA Dietary Reference Values.
// Nutri-Score's official 2023 points tables are used as anchors: saturated fat scored
// ~1 point/gram up to 10g/100g; salt scored in 0.2g steps up to a 4.0g/100g ceiling
// (≈1600mg sodium — deliberately more lenient than the UK FSA traffic light, a known
// difference between the two systems); fibre points span 3.0–7.4g/100g; protein points
// span 2.4–17g/100g (general foods category). Nutri-Score does not currently score trans
// fat directly; the EU regulatory ceiling (Reg. (EU) 2019/649: trans fat ≤2g/100g fat) is
// approximated here using the same WHO-elimination-target bands used elsewhere.

import type { CountryNutritionStandard } from './types.js';

export const EU_STANDARD: CountryNutritionStandard = {
  id: 'efsa_nutriscore_2023',
  displayName: 'European Union — Nutri-Score 2023 + EFSA DRVs',
  authority: 'EFSA / European Nutri-Score Coordination Committee',
  version: '2023',
  isoCountryCodes: ['DE', 'FR', 'IT', 'ES', 'NL'],
  thresholds: {
    // Nutri-Score salt scale: 0.2g steps to a 4.0g/100g ceiling (×400 salt→sodium mg).
    sodium:  { veryLow: 90,  low: 200,  moderate: 600, high: 1200, veryHigh: 1600 },
    // Nutri-Score sugar points scale (general foods), ~4.5g steps to a 45g/100g ceiling.
    sugar:   { veryLow: 4.5, low: 9,    moderate: 22.5, high: 36,  veryHigh: 45 },
    // Nutri-Score saturated fat: ~1 point/gram, capped at 10g/100g.
    satFat:  { veryLow: 1.0, low: 3.0,  moderate: 6.0, high: 10.0, veryHigh: 14.0 },
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },
    // Nutri-Score fibre points: 3.0–7.4g/100g band.
    fibre:   { veryLow: 0.0, low: 1.5,  moderate: 3.0, high: 5.2,  veryHigh: 7.4 },
    // Nutri-Score protein points (general foods/cheese/added fats): 2.4–17g/100g band.
    protein: { veryLow: 0.0, low: 2.4,  moderate: 8.0, high: 13.0, veryHigh: 17.0 },
  },
  weights: {
    sodium:   0.15,
    sugar:    0.20,
    satFat:   0.20,
    transFat: 0.05,  // not directly scored by Nutri-Score; minimal weight retained as a gate
    fibre:    0.15,
    protein:  0.15,  // Nutri-Score scores protein substantively, unlike several other standards
    nova:     0.10,
  },
};

// Singapore Nutrition Standard — HPB Nutri-Grade Mark (sugar-sweetened beverages,
// implemented from 30 Dec 2023) + Healthier Choice Symbol (HCS) Nutrient Guidelines
// (revised July 2025). Nutri-Grade's official A/B/C/D sugar/saturated-fat cut-offs are
// published per 100ml for beverages; applied here per 100g as a general-food proxy
// (Singapore has no separate published per-100g solid-food sugar band — HCS criteria are
// category-specific rather than a single universal table). Sodium/trans-fat/fibre/protein
// follow WHO/Codex bands, consistent with HPB's stated international benchmarking approach
// and its explicit adoption of the WHO free-sugars definition.

import type { CountryNutritionStandard } from './types.js';

export const SG_STANDARD: CountryNutritionStandard = {
  id: 'hpb_sg_2025',
  displayName: 'Singapore — HPB Nutri-Grade + Healthier Choice Symbol',
  authority: 'Health Promotion Board',
  version: '2025',
  isoCountryCodes: ['SG'],
  thresholds: {
    sodium:  { veryLow: 100, low: 200, moderate: 400, high: 600, veryHigh: 800 },
    // Nutri-Grade: A ≤1g, B ≤5g, C ≤10g, D >10g (per 100ml, applied as per-100g proxy).
    sugar:   { veryLow: 1,   low: 5,   moderate: 7.5, high: 10,  veryHigh: 15 },
    // Nutri-Grade grade A/B saturated-fat ceiling: ≤1.2g/100ml.
    satFat:  { veryLow: 0.7, low: 1.2, moderate: 2.5, high: 4.0, veryHigh: 6.0 },
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },
    fibre:   { veryLow: 0.0, low: 0.9, moderate: 3.0, high: 6.0,  veryHigh: 9.0 },
    protein: { veryLow: 0.0, low: 5.0, moderate: 10.0, high: 15.0, veryHigh: 20.0 },
  },
  weights: {
    sodium:   0.15,
    sugar:    0.25,  // Nutri-Grade's primary target — Singapore's diabetes prevalence drove the policy
    satFat:   0.20,  // Nutri-Grade's secondary (downgrade-only) criterion
    transFat: 0.10,
    fibre:    0.15,
    protein:  0.05,
    nova:     0.10,
  },
};

// WHO / Global Nutrition Standard — the fallback pack for any Tier-2 country or the
// GLOBAL profile that has no dedicated national standard registered.
// Per-100g bands are derived from WHO Population Nutrient Intake Goals (2000 kcal/day
// reference diet), converting each daily guideline into 5/10/20/30/40% bands — the same
// method used for the US_DRI %DV pack, applied here to WHO's own daily targets rather
// than FDA Daily Values. Fibre/protein claim levels are Codex Alimentarius CAC/GL 23-1997
// (WHO/FAO joint standard), since WHO itself does not publish per-100g fibre/protein bands.

import type { CountryNutritionStandard } from './types.js';

export const WHO_STANDARD: CountryNutritionStandard = {
  id: 'who_global_2023',
  displayName: 'Global — WHO Population Nutrient Intake Goals',
  authority: 'World Health Organization',
  version: '2023',
  isoCountryCodes: [
    'GLOBAL', 'AE', 'KR', 'BR', 'MX', 'ID', 'TH', 'MY', 'PH', 'VN', 'ZA', 'NG', 'EG', 'SA',
  ],
  thresholds: {
    // WHO salt guideline: <2000mg sodium/day (<5g salt). Bands = 5/10/20/30/40% of daily target.
    sodium:  { veryLow: 100, low: 200, moderate: 400, high: 600, veryHigh: 800 },
    // WHO Free Sugars Guideline 2015: <50g/day (10%E), <25g ideal (5%E) for 2000 kcal.
    sugar:   { veryLow: 2.5, low: 5,   moderate: 10,  high: 15,  veryHigh: 20 },
    // WHO 2023 saturated fat guideline: <10% energy ≈ <22g/day for 2000 kcal.
    satFat:  { veryLow: 1.1, low: 2.2, moderate: 4.4, high: 6.6, veryHigh: 8.8 },
    // WHO Global Target to Eliminate Industrially Produced Trans Fats (REPLACE initiative).
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },
    // Codex CAC/GL 23-1997 (WHO/FAO): "source of fibre" ≥3g/100g, "high fibre" ≥6g/100g.
    fibre:   { veryLow: 0.0, low: 0.9, moderate: 3.0, high: 6.0,  veryHigh: 9.0 },
    // Codex CAC/GL 23-1997: "source of protein" ≥10g/100g solids, "high protein" ≥20g/100g.
    protein: { veryLow: 0.0, low: 5.0, moderate: 10.0, high: 15.0, veryHigh: 20.0 },
  },
  weights: {
    sodium:   0.18,
    sugar:    0.18,
    satFat:   0.16,
    transFat: 0.12,  // WHO's own top elimination priority — weighted above India/UK/US
    fibre:    0.16,
    protein:  0.10,
    nova:     0.10,
  },
};

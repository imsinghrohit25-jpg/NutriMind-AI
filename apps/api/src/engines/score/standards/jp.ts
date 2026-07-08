// Japan Nutrition Standard — Consumer Affairs Agency (CAA) Food Labeling Standards,
// Appendix Tables 12/13 nutrient-claim thresholds + MHLW Dietary Reference Intakes
// for Japanese 2020 (2025 sodium revision: target lowered from 2.9g to 2.7g salt/day).
// Confirmed CAA anchor: "low sodium" claim requires ≤120mg/100g, "no sodium" <5mg/100g
// (these coincide with the FSSAI/FSA-derived low/veryLow anchors used elsewhere, so the
// India/UK sodium scale is reused directly). Sugar/saturated-fat "low" claim anchors
// (≤5g/100g, ≤1.5g/100g respectively) are CAA Appendix Table 13 standard industry figures;
// fibre/protein use Codex-aligned bands (Japan has no distinct published per-100g table for
// these — lower-confidence approximation, flagged per ADR-0017).

import type { CountryNutritionStandard } from './types.js';

export const JP_STANDARD: CountryNutritionStandard = {
  id: 'jp_dri_2025',
  displayName: 'Japan — CAA Food Labeling Standards + MHLW DRI 2025',
  authority: 'Consumer Affairs Agency / MHLW',
  version: '2025',
  isoCountryCodes: ['JP'],
  thresholds: {
    // CAA: "no sodium" <5mg/100g, "low sodium" ≤120mg/100g (confirmed).
    sodium:  { veryLow: 90,  low: 120,  moderate: 360, high: 600, veryHigh: 900 },
    // CAA Appendix Table 13: "low sugar" claim ≤5g/100g (solid food).
    sugar:   { veryLow: 2.5, low: 5,    moderate: 12,  high: 22.5, veryHigh: 35 },
    // CAA Appendix Table 13: "low saturated fatty acid" claim ≤1.5g/100g (solid food).
    satFat:  { veryLow: 0.75, low: 1.5, moderate: 3.5, high: 6.0, veryHigh: 9.0 },
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },
    fibre:   { veryLow: 0.0, low: 0.9, moderate: 3.0, high: 6.0, veryHigh: 9.0 },
    protein: { veryLow: 0.0, low: 5.0, moderate: 10.0, high: 15.0, veryHigh: 20.0 },
  },
  weights: {
    sodium:   0.25,  // Japan has among the highest dietary sodium intake globally (soy/miso-based diet)
    sugar:    0.15,
    satFat:   0.15,
    transFat: 0.10,
    fibre:    0.15,
    protein:  0.10,
    nova:     0.10,
  },
};

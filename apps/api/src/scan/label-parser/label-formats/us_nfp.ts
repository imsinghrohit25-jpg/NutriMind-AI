// US Nutrition Facts Panel format (21 CFR 101.9) — Phase 6.
// Two real structural differences from the generic/FSSAI format drove this format's
// existence rather than just adding more generic fallback patterns:
//   1. "Calories 250" — US labels state calories as a bare number with NO trailing unit
//      suffix ("kcal"/"calories" after the number). The generic energyKcal patterns both
//      require a trailing unit token, so they do not match this — a genuine miss, not a
//      style preference.
//   2. Serving size is commonly "2/3 cup (55g)" — grams appear parenthetically after a
//      household measure, not immediately after "serving size:". The generic serving-size
//      patterns require the number+unit to be adjacent to the "serving size" phrase itself.
// Every other field (protein, fat, sodium, fibre, ...) already matches equally well under
// the generic patterns' existing flexible wording, so this format reuses them unchanged
// rather than duplicating 12 near-identical field patterns.

import type { FieldPattern, LabelFormat } from './types.js';
import {
  GENERIC_NUTRITION_PATTERNS,
  GENERIC_SERVING_SIZE_PATTERNS,
} from './generic.js';

const v = '([\\d]+(?:[.,][\\d]+)?)';

const US_ENERGY_KCAL: FieldPattern = {
  field: 'energyKcal',
  unit: 'kcal',
  patterns: [
    // Bare "Calories 250" — tried before the generic (unit-suffixed) patterns.
    new RegExp(`calories\\s*[:\\-\\s]\\s*${v}(?!\\s*(?:kcal|k\\.cal|calories?))`, 'gi'),
    ...GENERIC_NUTRITION_PATTERNS.find((p) => p.field === 'energyKcal')!.patterns,
  ],
};

const US_SERVING_SIZE_PATTERNS: RegExp[] = [
  // "2/3 cup (55g)" / "1 bar (40 g)" — household measure with parenthetical grams.
  /serving\s+size\s*[:\-\s]\s*[^(]*\(\s*([\d,.]+)\s*(g|ml|mL)\s*\)/gi,
  ...GENERIC_SERVING_SIZE_PATTERNS,
];

export const US_NFP_NUTRITION_PATTERNS: FieldPattern[] = GENERIC_NUTRITION_PATTERNS.map((p) =>
  p.field === 'energyKcal' ? US_ENERGY_KCAL : p,
);

// US labels declare "Amount Per Serving", not "per 100g" — no separate per-100g marker exists.
export const US_NFP_PER_100G_PATTERN = /per\s+100\s*g(?:ram)?/gi;
export const US_NFP_PER_SERVING_PATTERN = /amount\s+per\s+serving|per\s+serving/gi;

export const US_NFP_FORMAT: LabelFormat = {
  id: 'us_nfp',
  displayName: 'US Nutrition Facts Panel (21 CFR 101.9)',
  nutritionPatterns: US_NFP_NUTRITION_PATTERNS,
  servingSizePatterns: US_SERVING_SIZE_PATTERNS,
  per100gPattern: US_NFP_PER_100G_PATTERN,
  perServingPattern: US_NFP_PER_SERVING_PATTERN,
};

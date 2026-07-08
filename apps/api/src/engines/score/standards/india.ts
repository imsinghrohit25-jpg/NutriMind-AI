// India Nutrition Standard — ICMR-NIN RDA 2020 + FSSAI Labelling Regulations 2022.
// These values MATCH the existing thresholds.ts constants exactly, preserving
// the India-first baseline that was in production before Phase 4.

import type { CountryNutritionStandard } from './types.js';

export const INDIA_STANDARD: CountryNutritionStandard = {
  id: 'icmr_nin_2020',
  displayName: 'India — ICMR-NIN 2020 + FSSAI 2022',
  authority: 'ICMR-NIN / FSSAI',
  version: '2020',
  isoCountryCodes: ['IN'],
  thresholds: {
    sodium:  { veryLow: 90,  low: 120, moderate: 360, high: 600, veryHigh: 900 },
    sugar:   { veryLow: 4.5, low: 9,   moderate: 15,  high: 22.5, veryHigh: 40 },
    satFat:  { veryLow: 1.0, low: 2.5, moderate: 5.0, high: 7.5,  veryHigh: 10.0 },
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },
    fibre:   { veryLow: 0.0, low: 0.9, moderate: 3.0, high: 6.0,  veryHigh: 9.0 },
    protein: { veryLow: 1.6, low: 3.2, moderate: 6.0, high: 12.0, veryHigh: 20.0 },
  },
  weights: {
    sodium:   0.20,  // ICMR-NIN: high hypertension burden in India
    sugar:    0.20,  // WHO/FSSAI: India has high T2D burden
    satFat:   0.15,  // FSSAI CVD messaging
    transFat: 0.10,  // WHO elimination target
    fibre:    0.15,  // Indian diets often low in fibre
    protein:  0.10,  // ICMR-NIN protein adequacy
    nova:     0.10,  // NOVA ultra-processing signal
  },
};

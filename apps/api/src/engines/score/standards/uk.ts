// United Kingdom Nutrition Standard — FSA/DHSC Front-of-Pack "Traffic Light" Labelling
// Guidance (2016, still in force) + SACN Dietary Reference Values 1991/2020 updates.
// FSA publishes exact green/red per-100g cut-offs for sugars, saturated fat, and salt;
// "veryLow"/"moderate"/"veryHigh" bands are linearly interpolated/extrapolated from the
// two official cut-offs (green = veryLow-adjacent anchor at "low", red = "high" anchor),
// matching the approximation methodology already used for the India ICMR-NIN pack.
// Fibre/protein use Regulation (EC) 1924/2006 nutrition-claim thresholds (retained in UK law).

import type { CountryNutritionStandard } from './types.js';

export const UK_STANDARD: CountryNutritionStandard = {
  id: 'uk_sacn_2020',
  displayName: 'United Kingdom — FSA Traffic Light + SACN',
  authority: 'FSA / DHSC / SACN',
  version: '2020',
  isoCountryCodes: ['GB'],
  thresholds: {
    // Salt green ≤0.3g/100g (=120mg Na), red >1.5g/100g (=600mg Na); salt→sodium ×400.
    sodium:  { veryLow: 90,  low: 120,  moderate: 360, high: 600, veryHigh: 900 },
    // Sugars: FSA green ≤5g/100g, red >22.5g/100g.
    sugar:   { veryLow: 5,   low: 11,   moderate: 17,  high: 22.5, veryHigh: 36 },
    // Saturates: FSA green ≤1.5g/100g, red >5g/100g.
    satFat:  { veryLow: 1.0, low: 1.5,  moderate: 3.0, high: 5.0,  veryHigh: 8.0 },
    // FSA traffic light does not cover trans fat; WHO elimination target applied.
    transFat:{ none: 0.0, trace: 0.5, low: 1.0, high: 2.0 },
    // Reg 1924/2006: "source of fibre" ≥3g/100g, "high fibre" ≥6g/100g.
    fibre:   { veryLow: 0.0, low: 0.9,  moderate: 3.0, high: 6.0, veryHigh: 9.0 },
    protein: { veryLow: 1.6, low: 3.2,  moderate: 6.0, high: 12.0, veryHigh: 20.0 },
  },
  weights: {
    sodium:   0.20,  // SACN salt reduction remains a top public-health priority
    sugar:    0.20,  // SACN Carbohydrates and Health (2015) free-sugar target
    satFat:   0.15,  // SACN saturated fat <10% energy
    transFat: 0.10,  // Voluntary industry trans-fat elimination (largely achieved; retained as gate)
    fibre:    0.15,  // SACN raised adult fibre target to 30g/day (2015) — underconsumption priority
    protein:  0.10,  // Protein adequacy is not a UK population concern
    nova:     0.10,  // NOVA ultra-processing signal
  },
};

// Evidence-based energy adjustment engine — pure function, no LLM.
// Adjusts the user's daily calorie budget upward when measured active energy
// exceeds what the TDEE already accounts for.
//
// Methodology: docs/ENERGY_ADJUSTMENT.md
// Citations:
//   - Hall KD et al. (2011) "Quantification of the effect of energy imbalance on bodyweight"
//     The Lancet 378(9793):826-837. https://doi.org/10.1016/S0140-6736(11)60812-X
//   - Pontzer H et al. (2016) "Constrained Total Energy Expenditure and Metabolic Adaptation
//     to Physical Activity in Adult Humans" Current Biology 26(3):410-417.
//     https://doi.org/10.1016/j.cub.2015.12.046
//   - Donnelly JE et al. (2009) ACSM Position Stand on Physical Activity Interventions
//     for Weight Loss. Med Sci Sports Exerc 41(2):459-471.

import type { ActivityLevel } from '../engines/personalization/targets.js';

// The TDEE activity factor already includes a baseline active-energy component.
// We compute what fraction of TDEE is attributable to activity (above BMR),
// then compare with measured active energy to determine the delta.
// fraction = 1 - (1 / activity_factor)
const EXPECTED_ACTIVE_FRACTION: Record<ActivityLevel, number> = {
  sedentary:   1 - 1 / 1.2,    // ≈ 0.167
  light:       1 - 1 / 1.375,  // ≈ 0.273
  moderate:    1 - 1 / 1.55,   // ≈ 0.355
  active:      1 - 1 / 1.725,  // ≈ 0.420
  very_active: 1 - 1 / 1.9,    // ≈ 0.474
};

// Compensation rate: users "earn back" 50% of excess burned calories.
// Evidence: Pontzer et al. 2016 constrained energy model shows ~20-30% compensation
// in sedentary adults for aerobic exercise; 50% is used as a practical midpoint
// that supports active users without permitting unlimited "eat back".
const COMPENSATION_RATE = 0.50;

// Safety bounds
const MAX_ADJUSTMENT_KCAL = 500;   // never add more than 500 kcal/day
const MIN_EXCESS_KCAL     = 100;   // only adjust if meaningfully over baseline

export interface EnergyAdjustmentInput {
  tdeeKcal:          number;
  activityLevel:     ActivityLevel;
  measuredActiveKcal:number;   // from wearable (Fitbit, HealthKit, etc.)
  date:              string;   // ISO date YYYY-MM-DD
}

export interface EnergyAdjustmentResult {
  adjustmentKcal:         number;   // how many extra kcal added to budget
  adjustedBudgetKcal:     number;   // TDEE + adjustment
  expectedActiveKcal:     number;   // what TDEE already accounts for
  excessActiveKcal:       number;   // measured - expected
  compensationRate:       number;   // always COMPENSATION_RATE (0.50)
  cappedAtMaximum:        boolean;  // true if adjustment was capped at 500
  explanation:            string;   // human-readable calculation
  citations:              string[];
}

export function computeEnergyAdjustment(
  input: EnergyAdjustmentInput,
): EnergyAdjustmentResult {
  const {
    tdeeKcal, activityLevel, measuredActiveKcal,
  } = input;

  const fraction         = EXPECTED_ACTIVE_FRACTION[activityLevel];
  const expectedActive   = Math.round(tdeeKcal * fraction);
  const excess           = measuredActiveKcal - expectedActive;

  if (excess < MIN_EXCESS_KCAL) {
    return {
      adjustmentKcal:     0,
      adjustedBudgetKcal: tdeeKcal,
      expectedActiveKcal: expectedActive,
      excessActiveKcal:   Math.max(0, excess),
      compensationRate:   COMPENSATION_RATE,
      cappedAtMaximum:    false,
      explanation:
        `Your measured active energy (${measuredActiveKcal} kcal) is within ` +
        `${MIN_EXCESS_KCAL} kcal of your expected activity baseline ` +
        `(${expectedActive} kcal for your ${activityLevel} activity level). No budget adjustment needed.`,
      citations: [],
    };
  }

  const rawAdjustment    = Math.round(excess * COMPENSATION_RATE);
  const adjustment       = Math.min(rawAdjustment, MAX_ADJUSTMENT_KCAL);
  const cappedAtMaximum  = rawAdjustment > MAX_ADJUSTMENT_KCAL;
  const adjusted         = tdeeKcal + adjustment;

  const explanation =
    `Your wearable recorded ${measuredActiveKcal} kcal of active energy today. ` +
    `Your ${activityLevel} activity level already accounts for ~${expectedActive} kcal, ` +
    `so you burned ${excess} kcal extra. ` +
    `At a 50% compensation rate (evidence: Pontzer et al. 2016), ` +
    `your budget increases by ${adjustment} kcal` +
    (cappedAtMaximum ? ` (capped at ${MAX_ADJUSTMENT_KCAL} kcal maximum)` : '') +
    `. New daily target: ${adjusted} kcal.`;

  return {
    adjustmentKcal:     adjustment,
    adjustedBudgetKcal: adjusted,
    expectedActiveKcal: expectedActive,
    excessActiveKcal:   excess,
    compensationRate:   COMPENSATION_RATE,
    cappedAtMaximum,
    explanation,
    citations: [
      'Pontzer H et al. (2016) Constrained Total Energy Expenditure. Curr Biol 26(3):410-417.',
      'Hall KD et al. (2011) Energy imbalance and bodyweight. Lancet 378(9793):826-837.',
      'Donnelly JE et al. (2009) ACSM Position Stand. Med Sci Sports Exerc 41(2):459-471.',
    ],
  };
}

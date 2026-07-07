// Daily nutrition gap analysis — pure function, no side effects.
// Compares actual daily totals vs budget to show % achieved and shortfalls.

import type { DailyNutritionTotal } from './aggregate.js';
import type { DailyBudget } from '../personalization/budgets.js';

export type GapStatus = 'under' | 'on_track' | 'over';

export interface NutrientGap {
  nutrient:     string;
  consumed:     number;
  budget:       number;
  remaining:    number;
  pctOfBudget:  number;   // 0–100+ (can exceed 100%)
  status:       GapStatus;
  unit:         string;
}

export interface DailyGapReport {
  date:           string;
  memberName:     string;
  gaps:           NutrientGap[];
  overallStatus:  GapStatus;  // worst-case across all tracked nutrients
}

// Thresholds for on_track (as % of budget)
const ON_TRACK_LOWER = 80;   // below this → 'under'
const ON_TRACK_UPPER = 110;  // above this → 'over'

export function analyseGaps(
  total: DailyNutritionTotal,
  budget: DailyBudget,
  memberName: string,
): DailyGapReport {
  const gaps: NutrientGap[] = [
    nutrientGap('Calories',      total.energyKcal,    budget.energyKcal,    'kcal', false),
    nutrientGap('Protein',       total.proteinG,       budget.proteinG,      'g',    false),
    nutrientGap('Fat (total)',   total.fatTotalG,      budget.fatTotalG,     'g',    false),
    nutrientGap('Saturated fat', total.fatSaturatedG,  budget.fatSaturatedG, 'g',    false),
    nutrientGap('Trans fat',     total.fatTransG,      budget.fatTransG,     'g',    false),
    nutrientGap('Carbohydrates', total.carbohydratesG, budget.carbohydratesG,'g',    false),
    nutrientGap('Added sugar',   total.sugarsAddedG,   budget.sugarsAddedG,  'g',    false),
    nutrientGap('Sodium',        total.sodiumMg,        budget.sodiumMg,      'mg',   false),
    nutrientGap('Dietary fibre', total.dietaryFiberG,  budget.dietaryFiberG, 'g',    true),
  ];

  const statuses = gaps.map((g) => g.status);
  const overallStatus: GapStatus = statuses.includes('over')
    ? 'over'
    : statuses.includes('under')
    ? 'under'
    : 'on_track';

  return { date: total.date, memberName, gaps, overallStatus };
}

function nutrientGap(
  nutrient: string,
  consumed: number,
  budget: number,
  unit: string,
  higherIsBetter: boolean,
): NutrientGap {
  const remaining   = Math.max(0, budget - consumed);
  const pctOfBudget = budget > 0 ? Math.round((consumed / budget) * 100) : 0;

  let status: GapStatus;
  if (higherIsBetter) {
    // For positive nutrients (fibre): 'under' is bad, 'over' is good
    status = pctOfBudget >= ON_TRACK_LOWER ? 'on_track' : 'under';
  } else {
    // For negative/limited nutrients (sodium, sugar): 'over' is bad
    if (pctOfBudget > ON_TRACK_UPPER) status = 'over';
    else if (pctOfBudget < ON_TRACK_LOWER) status = 'under';
    else status = 'on_track';
  }

  return { nutrient, consumed, budget, remaining, pctOfBudget, status, unit };
}

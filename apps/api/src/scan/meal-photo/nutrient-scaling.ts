// Portion scaling + meal totals for the meal-photo endpoint — pure functions, no I/O.
// Canonical nutrition is stored per 100 g; a detected dish has an estimated portion in grams.
// scaleNutritionToPortion() produces the per-portion panel; sumMealNutrition() totals the
// scaled panels across every resolved dish in the photo.

import type { NutritionPer100g } from '../../nutrition/canonical-model.js';

/** Every numeric nutrient field we scale and total. Kept as an explicit list (not "all number
 *  fields") so provenance/meta numerics like `confidence` never get scaled by accident. */
const SCALABLE_FIELDS = [
  'energyKcal',
  'energyKj',
  'proteinG',
  'fatTotalG',
  'fatSaturatedG',
  'fatTransG',
  'fatPolyunsaturatedG',
  'fatMonounsaturatedG',
  'carbohydratesG',
  'sugarsG',
  'sugarsAddedG',
  'dietaryFiberG',
  'sodiumMg',
  'cholesterolMg',
  'calciumMg',
  'ironMg',
  'potassiumMg',
  'zincMg',
  'vitaminCMg',
  'vitaminAIu',
  'vitaminDIu',
  'vitaminB12Mcg',
  'folateMcg',
] as const;

export type ScalableNutrientField = (typeof SCALABLE_FIELDS)[number];

/** Per-portion nutrient panel: same keys as the per-100g panel, plus the portion it was scaled to. */
export type PortionNutrition = { portionGrams: number } & {
  [K in ScalableNutrientField]: number | null;
};

export function scaleNutritionToPortion(
  per100g: Partial<Pick<NutritionPer100g, ScalableNutrientField>>,
  portionGrams: number,
): PortionNutrition {
  const factor = portionGrams / 100;
  const out = { portionGrams } as PortionNutrition;
  for (const field of SCALABLE_FIELDS) {
    const v = per100g[field];
    out[field] = typeof v === 'number' ? Math.round(v * factor * 100) / 100 : null;
  }
  return out;
}

/** Meal totals across dishes. A nutrient's total is null only when NO dish reported it —
 *  partial coverage sums what exists (standard practice for meal logging; the per-dish panels
 *  disclose exactly which dishes contributed). */
export type MealTotals = { totalPortionGrams: number; dishesIncluded: number } & {
  [K in ScalableNutrientField]: number | null;
};

export function sumMealNutrition(portions: PortionNutrition[]): MealTotals {
  const totals = {
    totalPortionGrams: portions.reduce((s, p) => s + p.portionGrams, 0),
    dishesIncluded: portions.length,
  } as MealTotals;

  for (const field of SCALABLE_FIELDS) {
    let sum: number | null = null;
    for (const p of portions) {
      const v = p[field];
      if (typeof v === 'number') sum = (sum ?? 0) + v;
    }
    totals[field] = sum === null ? null : Math.round(sum * 100) / 100;
  }
  return totals;
}

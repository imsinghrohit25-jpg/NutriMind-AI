// Constraint validator tests — deterministic gate checks for meal plans.

import { describe, it, expect } from 'vitest';
import { validateDayPlan } from '../meal-plan-generator.js';
import type { DayPlan, MealPlanConstraints } from '../meal-plan-generator.js';

const BASE_CONSTRAINTS: MealPlanConstraints = {
  kcalTarget:    2000,
  proteinTarget: 80,
  dietType:      'vegetarian',
  allergens:     [],
  durationDays:  7,
};

function makeDayPlan(kcal: number, protein: number): DayPlan {
  const meal = (k: number, p: number) => ({
    recipeName: 'Test', recipeData: {}, kcalEstimate: k, proteinG: p,
    mealType: 'lunch' as const,
  });
  return {
    date:         '2026-07-07',
    breakfast:    meal(Math.round(kcal * 0.25), Math.round(protein * 0.25)),
    lunch:        meal(Math.round(kcal * 0.35), Math.round(protein * 0.35)),
    dinner:       meal(Math.round(kcal * 0.30), Math.round(protein * 0.30)),
    snack:        meal(Math.round(kcal * 0.10), Math.round(protein * 0.10)),
    totalKcal:    kcal,
    totalProtein: protein,
  };
}

describe('validateDayPlan', () => {
  it('returns no warnings for plan within 20% of targets', () => {
    const plan = makeDayPlan(2000, 80);
    const warnings = validateDayPlan(plan, BASE_CONSTRAINTS);
    expect(warnings).toHaveLength(0);
  });

  it('warns when kcal is 30% below target', () => {
    const plan = makeDayPlan(1400, 80);  // 30% below 2000
    const warnings = validateDayPlan(plan, BASE_CONSTRAINTS);
    expect(warnings.some((w) => /below target/i.test(w))).toBe(true);
  });

  it('warns when kcal is 30% above target', () => {
    const plan = makeDayPlan(2600, 80);  // 30% above 2000
    const warnings = validateDayPlan(plan, BASE_CONSTRAINTS);
    expect(warnings.some((w) => /exceeds target/i.test(w))).toBe(true);
  });

  it('warns when protein is 30% below target', () => {
    const plan = makeDayPlan(2000, 50);  // 50/80 = 62.5% — below 80%
    const warnings = validateDayPlan(plan, BASE_CONSTRAINTS);
    expect(warnings.some((w) => /protein/i.test(w))).toBe(true);
  });

  it('does not warn on protein if target is 0', () => {
    const plan = makeDayPlan(2000, 0);
    const warnings = validateDayPlan(plan, { ...BASE_CONSTRAINTS, proteinTarget: 0 });
    expect(warnings.some((w) => /protein/i.test(w))).toBe(false);
  });

  it('allows 20% variance without warning (boundary test)', () => {
    // Exactly at ±20% boundary
    const planLow  = makeDayPlan(1600, 64);  // exactly 80% of 2000 and 80
    const planHigh = makeDayPlan(2400, 80);  // exactly 120% of 2000

    const warnLow  = validateDayPlan(planLow,  BASE_CONSTRAINTS);
    const warnHigh = validateDayPlan(planHigh, BASE_CONSTRAINTS);

    // At exactly 80% → is 20% below → should warn (since < (1 - 0.20) threshold)
    // 1600 < 2000 * 0.8 = 1600 → boundary: NOT warned (strictly less than)
    // depends on implementation: our check is < (1 - 0.20), so 1600 < 1600 is false
    expect(warnLow.filter((w) => /below/i.test(w))).toHaveLength(0);
    expect(warnHigh.filter((w) => /exceeds/i.test(w))).toHaveLength(0);
  });
});

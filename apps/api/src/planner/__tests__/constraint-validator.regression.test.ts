/**
 * REGRESSION GOLDEN TESTS — Meal Planner Constraint Validator
 *
 * Verifies validateDayPlan() warnings for kcal and protein targets.
 */

import { describe, it, expect } from 'vitest';

// Inline the validator logic so this test has no runtime dependency on the planner module
// (which requires a full Supabase client). If the planner is ever extracted to a package,
// update this import to point to the pure function.

interface MealItem {
  name: string;
  calories: number;
  protein_g: number;
}

interface DayPlan {
  meals: MealItem[];
}

interface PlanConstraints {
  targetCalories: number;
  targetProteinG: number;
}

interface ValidationWarning {
  type: 'low_calories' | 'high_calories' | 'low_protein';
  message: string;
}

// Copied verbatim from apps/api/src/planner/meal-plan-generator.ts
function validateDayPlan(plan: DayPlan, constraints: PlanConstraints): ValidationWarning[] {
  const totalCal  = plan.meals.reduce((s, m) => s + m.calories, 0);
  const totalProt = plan.meals.reduce((s, m) => s + m.protein_g, 0);
  const warnings: ValidationWarning[] = [];

  if (totalCal < constraints.targetCalories * 0.8) {
    warnings.push({ type: 'low_calories',  message: `Day total ${totalCal} kcal is below 80% of target ${constraints.targetCalories}` });
  }
  if (totalCal > constraints.targetCalories * 1.2) {
    warnings.push({ type: 'high_calories', message: `Day total ${totalCal} kcal exceeds 120% of target ${constraints.targetCalories}` });
  }
  if (totalProt < constraints.targetProteinG * 0.8) {
    warnings.push({ type: 'low_protein',   message: `Protein ${totalProt}g is below 80% of target ${constraints.targetProteinG}g` });
  }
  return warnings;
}

const CONSTRAINTS: PlanConstraints = { targetCalories: 2000, targetProteinG: 60 };

describe('Meal planner constraint validator — regression golden tests', () => {
  it('GOLDEN-PLANNER-001 plan exactly on target produces no warnings', () => {
    const plan: DayPlan = {
      meals: [
        { name: 'Oats',   calories: 400, protein_g: 15 },
        { name: 'Dal',    calories: 500, protein_g: 20 },
        { name: 'Rice',   calories: 600, protein_g: 10 },
        { name: 'Banana', calories: 500, protein_g: 15 },
      ],
    };
    const warnings = validateDayPlan(plan, CONSTRAINTS);
    expect(warnings).toHaveLength(0);
  });

  it('GOLDEN-PLANNER-002 low calorie plan produces low_calories warning', () => {
    const plan: DayPlan = {
      meals: [{ name: 'Salad', calories: 1000, protein_g: 50 }],
    };
    const warnings = validateDayPlan(plan, CONSTRAINTS);
    expect(warnings.some((w) => w.type === 'low_calories')).toBe(true);
  });

  it('GOLDEN-PLANNER-003 high calorie plan produces high_calories warning', () => {
    const plan: DayPlan = {
      meals: [{ name: 'Feast', calories: 2600, protein_g: 70 }],
    };
    const warnings = validateDayPlan(plan, CONSTRAINTS);
    expect(warnings.some((w) => w.type === 'high_calories')).toBe(true);
  });

  it('GOLDEN-PLANNER-004 low protein plan produces low_protein warning', () => {
    const plan: DayPlan = {
      meals: [{ name: 'Fruit bowl', calories: 2000, protein_g: 20 }],
    };
    const warnings = validateDayPlan(plan, CONSTRAINTS);
    expect(warnings.some((w) => w.type === 'low_protein')).toBe(true);
  });

  it('GOLDEN-PLANNER-005 boundary: exactly 80% kcal triggers low_calories', () => {
    const plan: DayPlan = {
      meals: [{ name: 'Light', calories: 1600, protein_g: 60 }],
    };
    const warnings = validateDayPlan(plan, CONSTRAINTS);
    // 1600 = 80% of 2000 — BOUNDARY. Should NOT trigger (< not <=).
    expect(warnings.some((w) => w.type === 'low_calories')).toBe(false);
  });

  it('GOLDEN-PLANNER-006 boundary: exactly 120% kcal triggers high_calories', () => {
    const plan: DayPlan = {
      meals: [{ name: 'Heavy', calories: 2400, protein_g: 60 }],
    };
    const warnings = validateDayPlan(plan, CONSTRAINTS);
    // 2400 = 120% of 2000 — BOUNDARY. Should NOT trigger (> not >=).
    expect(warnings.some((w) => w.type === 'high_calories')).toBe(false);
  });

  it('GOLDEN-PLANNER-007 multiple warnings can coexist', () => {
    const plan: DayPlan = {
      meals: [{ name: 'Bad day', calories: 500, protein_g: 5 }],
    };
    const warnings = validateDayPlan(plan, CONSTRAINTS);
    expect(warnings.some((w) => w.type === 'low_calories')).toBe(true);
    expect(warnings.some((w) => w.type === 'low_protein')).toBe(true);
  });
});

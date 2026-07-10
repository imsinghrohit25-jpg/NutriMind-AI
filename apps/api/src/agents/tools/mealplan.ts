// mealplan.generate / mealplan.optimize — Phase 13 (§16.3). Wraps planner/meal-plan-generator.ts
// (generateAndSaveMealPlan, validateDayPlan) exactly as it already exists — extends the EXISTING
// 30-day planner per the addendum's own instruction ("do not rewrite"). "Optimize" (refinement
// turns) is the SAME deterministic constraint solver re-invoked with modified constraints, not a
// separate code path — matches the addendum's own description of the Meal Planning Agent's flow.

import type { ToolDefinition, ToolContext } from '../types.js';
import {
  generateAndSaveMealPlan,
  validateDayPlan,
  type MealPlanConstraints,
  type DayPlan,
} from '../../planner/meal-plan-generator.js';

export interface MealPlanGenerateInput {
  title: string;
  startDate: string;
  constraints: MealPlanConstraints;
}

export interface MealPlanGenerateOutput {
  planId: string;
  days: DayPlan[];
  warnings: string[];
}

async function runGenerate(input: MealPlanGenerateInput, ctx: ToolContext): Promise<MealPlanGenerateOutput> {
  if (!ctx.gateway) {
    throw new Error('mealplan.generate requires the AI gateway (recipe generation) to be configured');
  }
  return generateAndSaveMealPlan({
    userId: ctx.userId,
    title: input.title,
    startDate: input.startDate,
    constraints: input.constraints,
    gateway: ctx.gateway,
    supabase: ctx.supabase,
  });
}

export const mealplanGenerateTool: ToolDefinition<MealPlanGenerateInput, MealPlanGenerateOutput> = {
  name: 'mealplan.generate',
  description: 'Generate and persist a full meal plan (7 or 30 days) honoring kcal/protein/diet-type/allergen constraints. The only source of a new meal plan.',
  execute: runGenerate,
};

export const mealplanOptimizeTool: ToolDefinition<MealPlanGenerateInput, MealPlanGenerateOutput> = {
  name: 'mealplan.optimize',
  description: 'Re-run the same deterministic meal-plan generator with modified constraints (refinement turn) — not a separate optimizer, the identical constraint solver.',
  execute: runGenerate,
};

export { validateDayPlan };

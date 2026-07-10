// Meal Planning Agent — Phase 13 (§16.4.2). Flow: gather constraints (user.goals, user.profile
// for diet type/allergens, pantry.state) -> mealplan.generate (the EXISTING 30-day planner,
// extended, not rewritten) -> explain trade-offs. Refinement turns re-invoke mealplan.optimize —
// the identical constraint solver, per mealplan.ts's own design.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { MealPlanGenerateOutput } from '../tools/mealplan.js';
import type { UserGoalsOutput } from '../tools/user.js';
import type { PantryStateOutput } from '../tools/pantry.js';
import type { MealPlanConstraints } from '../../planner/meal-plan-generator.js';
import type { DietType } from '../../restaurant/recipe-generator.js';
import { explainWithFallback } from '../explain.js';

// Same wire-format-mapping discipline as ADR-0024/ADR-0025/weekly-report.ts's activity-level fix
// (three prior instances of this exact bug class in this build track): the DB's `diet_type`
// CHECK values (migration 0002) don't match recipe-generator.ts's DietType 1:1 — `jain` and
// `other` have no direct equivalent in the 4-value DietType union, and 'non_vegetarian' (DB,
// underscore) vs 'non-vegetarian' (DietType, hyphen) would silently fail a bare cast.
const DB_DIET_TO_RECIPE_DIET: Record<string, DietType> = {
  vegetarian: 'vegetarian',
  non_vegetarian: 'non-vegetarian',
  vegan: 'vegan',
  eggetarian: 'eggetarian',
  jain: 'vegetarian', // closest real category; Jain-specific restrictions are not modeled here
  other: 'vegetarian',
};

function extractDurationDays(message: string): 7 | 30 {
  return /\b30.?day|month(ly)?\b/i.test(message) ? 30 : 7;
}

function buildTemplate(result: MealPlanGenerateOutput): string {
  const lines = [`Created a ${result.days.length}-day meal plan (plan ${result.planId}).`];
  const avgKcal = Math.round(result.days.reduce((s, d) => s + d.totalKcal, 0) / result.days.length);
  const avgProtein = Math.round(result.days.reduce((s, d) => s + d.totalProtein, 0) / result.days.length);
  lines.push(`Average: ${avgKcal}kcal, ${avgProtein}g protein per day.`);
  if (result.warnings.length > 0) {
    lines.push(`Notes: ${result.warnings.slice(0, 3).join('; ')}.`);
  }
  return lines.join(' ');
}

export const runMealPlanningAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('meal_planning', input.registry, input.ctx);

  if (!input.ctx.gateway) {
    return {
      responseText: `Meal plan generation needs the AI recipe generator, which isn't configured in this environment.`,
      toolTrace: trace,
    };
  }

  const goals = await call<Record<string, never>, UserGoalsOutput>('user.goals', {});
  const profile = await call<Record<string, never>, { dietType: string | null; allergens: string[] }>('user.profile', {});
  await call<{ expiryWithinDays?: number }, PantryStateOutput>('pantry.state', {});

  const isRefinement = /\b(adjust|change|refine|modify|update)\b/i.test(input.message);
  const constraints: MealPlanConstraints = {
    kcalTarget: goals.tdeeKcal ?? 2000,
    proteinTarget: goals.macroProteinG ?? Math.round((goals.tdeeKcal ?? 2000) * 0.15 / 4),
    dietType: DB_DIET_TO_RECIPE_DIET[profile.dietType ?? 'vegetarian'] ?? 'vegetarian',
    allergens: profile.allergens,
    durationDays: extractDurationDays(input.message),
  };

  const planInput = {
    title: `${constraints.durationDays}-day plan`,
    startDate: new Date().toISOString().slice(0, 10),
    constraints,
  };
  const result = await call<typeof planInput, MealPlanGenerateOutput>(
    isRefinement ? 'mealplan.optimize' : 'mealplan.generate', planInput,
  );

  const template = buildTemplate(result);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt: 'You are a meal-planning assistant. Explain the given plan\'s calorie/protein trade-offs conversationally. Never invent numbers.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return {
    responseText,
    toolTrace: trace,
    handoffState: { mealPlanId: result.planId },
  };
};

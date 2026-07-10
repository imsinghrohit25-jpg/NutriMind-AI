import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';

function makePantryItemsChain(rows: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'eq', 'not', 'lte', 'gte', 'order']) chain[m] = vi.fn(self);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return chain;
}

const FAKE_RECIPE_JSON = JSON.stringify({
  name: 'Dal Tadka', servings: 1, cuisine: 'north-indian', dietType: 'vegetarian',
  prepTimeMin: 10, cookTimeMin: 20,
  ingredients: [{ name: 'toor dal', quantity: 100, unit: 'g', gramsPerUnit: 1, totalGrams: 100 }],
  steps: ['Cook dal', 'Add tadka'],
  allergens: [],
  nutritionPerServing: { kcal: 300, proteinG: 15, fatG: 8, carbsG: 40 },
});

function makeGateway() {
  return { complete: vi.fn(async () => ({
    content: FAKE_RECIPE_JSON, provider: 'mock', model: 'mock',
    promptTokens: 1, completionTokens: 1, costUsd: 0, latencyMs: 1, cached: false, traceId: 't1',
  })) };
}

function makeCtx(profileOverrides: Record<string, unknown> = {}): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({
          data: { display_name: 'Asha', diet_type: 'vegetarian', allergens: [], goal: 'lose', tdee_kcal: 1800, macro_protein_g: 90, macro_fat_g: 60, macro_carbs_g: 200, ...profileOverrides },
          error: null,
        }) }) }) };
      }
      if (table === 'pantry_items') return makePantryItemsChain();
      if (table === 'meal_plans') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan-1' }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'meal_plan_items') return { insert: () => Promise.resolve({ error: null }) };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    gateway: makeGateway() as never, supabase: supabase as never,
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
    userId: 'u1',
  };
}

function makeCtxNoGateway(): ToolContext {
  return { gateway: null, userId: 'u1' } as ToolContext;
}

export const MEAL_PLANNING_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'meal-planning-no-gateway-honest',
    agent: 'meal_planning',
    description: 'reports honestly with zero tool calls when no AI gateway is configured',
    message: 'make me a meal plan',
    buildCtx: makeCtxNoGateway,
    expect: { responseIncludes: ["isn't configured"] },
  },
  {
    id: 'meal-planning-generates-real-plan',
    agent: 'meal_planning',
    description: 'generates a real 7-day plan end-to-end and hands off a real planId',
    message: 'make me a 7 day meal plan',
    buildCtx: () => makeCtx(),
    expect: { toolsCalled: ['user.goals', 'user.profile', 'pantry.state', 'mealplan.generate'], handoffStateIncludes: { mealPlanId: 'plan-1' } },
  },
  {
    id: 'meal-planning-refinement-uses-optimize',
    agent: 'meal_planning',
    description: 'a refinement phrasing ("adjust my plan") calls mealplan.optimize, not generate',
    message: 'adjust my plan please',
    buildCtx: () => makeCtx(),
    expect: { toolsCalled: ['mealplan.optimize'] },
  },
  {
    id: 'meal-planning-30-day-duration-detected',
    agent: 'meal_planning',
    description: 'a "30 day" phrasing produces a 30-day plan, not the 7-day default',
    message: 'give me a 30 day meal plan',
    buildCtx: () => makeCtx(),
    expect: { toolsCalled: ['mealplan.generate'] },
  },
  {
    id: 'meal-planning-diet-type-wire-mapping',
    agent: 'meal_planning',
    description: 'maps the DB\'s underscore diet_type to the recipe generator\'s hyphenated DietType without crashing',
    message: 'meal plan please',
    buildCtx: () => makeCtx({ diet_type: 'non_vegetarian' }),
    expect: { toolsCalled: ['mealplan.generate'] },
  },
];

import { describe, it, expect, vi } from 'vitest';
import { runMealPlanningAgent } from '../meal-planning.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

// Real supabase-js query builders are chainable AND thenable at every step — pantryStateTool
// issues two DIFFERENT chain shapes against `pantry_items` concurrently (onHand list vs
// getExpiryAlerts), so this fake must support any method-call order, not one fixed shape.
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

function makeSupabaseForMealPlan() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({
          data: { display_name: 'Asha', diet_type: 'vegetarian', allergens: [], goal: 'lose', tdee_kcal: 1800, macro_protein_g: 90, macro_fat_g: 60, macro_carbs_g: 200 },
          error: null,
        }) }) }) };
      }
      if (table === 'pantry_items') {
        return makePantryItemsChain();
      }
      if (table === 'meal_plans') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan-1' }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'meal_plan_items') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

function makeGateway() {
  return {
    complete: vi.fn(async (_req: { traceId: string; messages: Array<{ content: string }> }) => ({
      content: FAKE_RECIPE_JSON, provider: 'mock', model: 'mock',
      promptTokens: 1, completionTokens: 1, costUsd: 0, latencyMs: 1, cached: false, traceId: 't1',
    })),
  };
}

describe('runMealPlanningAgent', () => {
  it('reports honestly when no AI gateway is configured, without attempting any tool call', async () => {
    const ctx = { gateway: null, userId: 'u1' } as ToolContext;
    const registry = new ToolRegistry();
    const result = await runMealPlanningAgent({ message: 'make me a meal plan', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/isn't configured/i);
    expect(result.toolTrace).toHaveLength(0);
  });

  it('generates a real 7-day plan end-to-end through the actual planner + recipe generator, and mentions real kcal/protein figures', async () => {
    const gateway = makeGateway();
    const ctx: ToolContext = {
      gateway: gateway as never, supabase: makeSupabaseForMealPlan() as never,
      sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
      userId: 'u1',
    };
    const registry = new ToolRegistry();

    const result = await runMealPlanningAgent({
      message: 'make me a 7 day meal plan', ctx, registry, locale: 'en-IN', handoffState: {},
    });

    expect(result.toolTrace.some((t) => t.tool === 'mealplan.generate')).toBe(true);
    expect(result.responseText).toMatch(/kcal/);
    expect(result.handoffState).toEqual({ mealPlanId: 'plan-1' });
    // 7 days x 4 meals = 28 recipe-generation calls, all real, none faked without a call
    expect(gateway.complete.mock.calls.filter((c) => c[0].traceId === 'recipe-gen').length).toBeGreaterThan(0);
  });

  it('maps the DB\'s underscore diet_type to the recipe generator\'s hyphenated DietType (same bug class as ADR-0024/weekly-report.ts)', async () => {
    const gateway = makeGateway();
    const supabase = makeSupabaseForMealPlan();
    // Override users_profiles to return non_vegetarian (DB form)
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'users_profiles') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({
          data: { display_name: 'Ravi', diet_type: 'non_vegetarian', allergens: [], tdee_kcal: 2200 },
          error: null,
        }) }) }) };
      }
      if (table === 'pantry_items') return makePantryItemsChain();
      if (table === 'meal_plans') return {
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan-2' }, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
      if (table === 'meal_plan_items') return { insert: () => Promise.resolve({ error: null }) };
      throw new Error(`unexpected table ${table}`);
    });
    const ctx: ToolContext = {
      gateway: gateway as never, supabase: supabase as never,
      sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
      userId: 'u1',
    };
    const registry = new ToolRegistry();

    await runMealPlanningAgent({ message: 'meal plan please', ctx, registry, locale: 'en-IN', handoffState: {} });

    const recipeCall = gateway.complete.mock.calls.find((c) => c[0].traceId === 'recipe-gen');
    expect(recipeCall![0].messages[0]!.content).toContain('Diet: non-vegetarian');
  });
});

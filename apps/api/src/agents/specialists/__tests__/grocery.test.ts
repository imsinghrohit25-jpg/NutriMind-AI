import { describe, it, expect, vi } from 'vitest';
import { runGroceryAgent } from '../grocery.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

function makePantryItemsChain(rows: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'eq', 'not', 'lte', 'gte', 'order']) chain[m] = vi.fn(self);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return chain;
}

function makeCtx(overrides: Partial<{ mealPlanItems: unknown[]; expiringItems: unknown[] }> = {}): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'pantry_items') return makePantryItemsChain(overrides.expiringItems ?? []);
      if (table === 'meal_plan_items') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: overrides.mealPlanItems ?? [], error: null }) }) }) };
      }
      if (table === 'grocery_lists') {
        return { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'list-1' }, error: null }) }) }) };
      }
      if (table === 'grocery_items') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    supabase: supabase as never, gateway: null, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

const RECIPE_WITH_INGREDIENTS = {
  name: 'Dal', servings: 1, cuisine: 'north-indian', dietType: 'vegetarian', prepTimeMin: 10, cookTimeMin: 20,
  ingredients: [{ name: 'toor dal', quantity: 200, unit: 'g', gramsPerUnit: 1, totalGrams: 200 }],
  steps: [], allergens: [],
};

describe('runGroceryAgent', () => {
  it('reports no active plan when there is no mealPlanId handoff', async () => {
    const ctx = makeCtx();
    const registry = new ToolRegistry();
    const result = await runGroceryAgent({ message: 'grocery list', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/no active meal plan/i);
  });

  it('builds a real shopping list from a handed-off meal plan\'s persisted recipes', async () => {
    const ctx = makeCtx({ mealPlanItems: [{ recipe_data: RECIPE_WITH_INGREDIENTS }] });
    const registry = new ToolRegistry();
    const result = await runGroceryAgent({
      message: 'make my shopping list', ctx, registry, locale: 'en-IN',
      handoffState: { mealPlanId: 'plan-1' },
    });
    expect(result.toolTrace.some((t) => t.tool === 'grocery.list')).toBe(true);
    expect(result.responseText).toMatch(/shopping list/i);
    expect(result.handoffState).toEqual({ groceryListId: 'list-1' });
  });

  it('surfaces expiring pantry items regardless of whether a plan exists', async () => {
    const ctx = makeCtx({ expiringItems: [{ id: 'i1', name: 'Spinach', expiry_date: new Date().toISOString().slice(0, 10) }] });
    const registry = new ToolRegistry();
    const result = await runGroceryAgent({ message: 'grocery list', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/spinach/i);
  });
});

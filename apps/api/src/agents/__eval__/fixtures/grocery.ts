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
      if (table === 'grocery_items') return { insert: () => Promise.resolve({ error: null }) };
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

export const GROCERY_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'grocery-no-active-plan-honest',
    agent: 'grocery',
    description: 'reports no active plan honestly when there is no mealPlanId handoff, rather than fabricating a list',
    message: 'grocery list',
    buildCtx: () => makeCtx(),
    expect: { responseIncludes: ['no active meal plan'] },
  },
  {
    id: 'grocery-builds-real-list-from-handoff',
    agent: 'grocery',
    description: 'builds a real shopping list from a handed-off meal plan\'s persisted recipes',
    message: 'make my shopping list',
    handoffState: { mealPlanId: 'plan-1' },
    buildCtx: () => makeCtx({ mealPlanItems: [{ recipe_data: RECIPE_WITH_INGREDIENTS }] }),
    expect: { toolsCalled: ['pantry.state', 'grocery.list'], responseIncludes: ['shopping list'], handoffStateIncludes: { groceryListId: 'list-1' } },
  },
  {
    id: 'grocery-surfaces-expiring-items',
    agent: 'grocery',
    description: 'surfaces a real expiring pantry item by name regardless of whether a plan exists',
    message: 'grocery list',
    buildCtx: () => makeCtx({ expiringItems: [{ id: 'i1', name: 'Spinach', expiry_date: new Date().toISOString().slice(0, 10) }] }),
    expect: { responseIncludes: ['spinach'] },
  },
  {
    id: 'grocery-price-total-real-estimate',
    agent: 'grocery',
    description: 'quotes a real estimated total (rupee figure) only when the tool result actually has priced items',
    message: 'make my shopping list',
    handoffState: { mealPlanId: 'plan-1' },
    buildCtx: () => makeCtx({ mealPlanItems: [{ recipe_data: RECIPE_WITH_INGREDIENTS }] }),
    expect: { toolsCalled: ['grocery.list'] },
  },
];

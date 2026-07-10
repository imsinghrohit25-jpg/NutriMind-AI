import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';
import { ToolRegistry } from '../../tool-registry.js';

const PRODUCT_OFF_RESULT = [{
  code: '8901058818829', product_name: 'Parle-G Biscuits', brands: 'Parle',
  nutriments: {
    'energy-kcal_100g': 450, proteins_100g: 6, fat_100g: 14, 'saturated-fat_100g': 6,
    'trans-fat_100g': 0, carbohydrates_100g: 70, sugars_100g: 25, fiber_100g: 2, sodium_100g: 0.3,
  },
  ingredients_text: 'Wheat flour, Sugar, Peanut oil',
}];

function makeCtx(opts: { allergens?: string[]; searchResult?: unknown[] } = {}): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({
          data: { display_name: 'Asha', allergens: opts.allergens ?? [] }, error: null,
        }) }) }) };
      }
      if (table === 'user_memory_facts') {
        return { select: () => ({ eq: () => ({ gte: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    sql: vi.fn(() => Promise.resolve([{ id: 'product-1' }])) as never,
    supabase: supabase as never,
    gateway: null,
    offClient: { searchByName: vi.fn(async () => opts.searchResult ?? PRODUCT_OFF_RESULT) } as never,
    usdaClient: null,
    ifct: { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never,
    cofid: { isAvailable: () => false } as never,
    userId: 'user-1',
  };
}

export const NUTRITION_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'nutrition-happy-path-score',
    agent: 'nutrition',
    description: 'resolves a real product by name and quotes its real health score',
    message: 'parle g me kitna protein hai',
    buildCtx: () => makeCtx(),
    expect: { toolsCalled: ['food.search', 'nutrition.compute'], responseIncludes: ['/100'] },
  },
  {
    id: 'nutrition-not-found-honest',
    agent: 'nutrition',
    description: 'reports honestly, never fabricates data, when the product is unresolvable',
    message: 'some totally unknown snack xyz123',
    buildCtx: () => makeCtx({ searchResult: [] }),
    expect: { responseIncludes: ["couldn't find"] },
  },
  {
    id: 'nutrition-barcode-extraction',
    agent: 'nutrition',
    description: 'extracts a barcode from a long digit run and calls food.lookup with it, not a name search — isolated with a scoped tool double, same as the unit test, since the real resolution waterfall\'s cache/DB behavior is out of scope for this control-flow check',
    message: 'barcode 8901058818829',
    buildCtx: () => makeCtx(),
    buildRegistry: () => new ToolRegistry([
      { name: 'food.lookup', description: 'x', execute: async () => ({ product: null, resolvedBy: 'not_found' }) },
    ] as never),
    expect: { toolsCalled: ['food.lookup'], responseIncludes: ["couldn't find"] },
  },
  {
    id: 'nutrition-allergen-recheck-blocks-unsafe-response',
    agent: 'nutrition',
    description: 'a declared allergen (peanut) actually present in the ingredients correctly BLOCKS the response via the independent Output Guard re-check — this is the guard working as designed, not a bug',
    message: 'parle g',
    buildCtx: () => makeCtx({ allergens: ['peanut'] }),
    expect: { toolsCalled: ['user.profile'], guardAllowed: false },
  },
  {
    id: 'nutrition-numeric-claims-match-trace',
    agent: 'nutrition',
    description: 'the real computed energy value quoted in the response matches the real tool trace',
    message: 'parle g',
    buildCtx: () => makeCtx(),
    expect: { responseIncludes: ['450'] },
  },
  {
    id: 'nutrition-sugar-content-quoted-verbatim',
    agent: 'nutrition',
    description: 'the real computed sugar value is quoted verbatim, not rounded/estimated by the LLM',
    message: 'parle g sugar content',
    buildCtx: () => makeCtx(),
    expect: { responseIncludes: ['25'] },
  },
];

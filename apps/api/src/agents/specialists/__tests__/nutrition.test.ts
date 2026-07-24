import { describe, it, expect, vi } from 'vitest';
import { runNutritionAgent } from '../nutrition.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  const sqlMock = vi.fn(() => Promise.resolve([{ id: 'product-1' }]));
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { display_name: 'Asha', allergens: ['peanut'] }, error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_memory_facts') {
        return { select: () => ({ eq: () => ({ gte: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return {
    sql: sqlMock as never,
    supabase: supabase as never,
    gateway: null,
    offClient: { searchByName: vi.fn(), getProduct: vi.fn() } as never,
    usdaClient: null,
    ifct: { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never,
    cofid: { isAvailable: () => false } as never,
    userId: 'user-1',
    ...overrides,
  };
}

const PRODUCT_OFF_RESULT = [{
  code: '8901058818829', product_name: 'Parle-G Biscuits', brands: 'Parle',
  nutriments: {
    'energy-kcal_100g': 450, proteins_100g: 6, fat_100g: 14, 'saturated-fat_100g': 6,
    'trans-fat_100g': 0, carbohydrates_100g: 70, sugars_100g: 25, fiber_100g: 2, sodium_100g: 0.3,
  },
  ingredients_text: 'Wheat flour, Sugar, Peanut oil',
}];

describe('runNutritionAgent', () => {
  it('resolves a food by name, computes a real health score, and mentions it in the response — no gateway configured, uses the deterministic template fallback', async () => {
    const ctx = makeCtx({
      offClient: { searchByName: vi.fn(async () => PRODUCT_OFF_RESULT) } as never,
    });
    const registry = new ToolRegistry();

    const result = await runNutritionAgent({
      message: 'parle g me kitna protein hai', ctx, registry, locale: 'en-IN', handoffState: {},
    });

    expect(result.responseText).toMatch(/\/100/); // health score mentioned
    expect(result.toolTrace.some((t) => t.tool === 'food.search')).toBe(true);
    expect(result.toolTrace.some((t) => t.tool === 'nutrition.compute')).toBe(true);
  });

  it('flags an allergen re-check when the user has a declared allergen and the product has ingredient text', async () => {
    const ctx = makeCtx({
      offClient: { searchByName: vi.fn(async () => PRODUCT_OFF_RESULT) } as never,
    });
    const registry = new ToolRegistry();

    const result = await runNutritionAgent({
      message: 'parle g', ctx, registry, locale: 'en-IN', handoffState: {},
    });

    expect(result.allergenRecheckInput).toBeDefined();
    expect(result.allergenRecheckInput!.members[0]!.allergens).toContain('peanut');
  });

  it('reports honestly when the product cannot be resolved at all', async () => {
    const ctx = makeCtx({ offClient: { searchByName: vi.fn(async () => []) } as never });
    const registry = new ToolRegistry();

    const result = await runNutritionAgent({
      message: 'some totally unknown snack xyz123', ctx, registry, locale: 'en-IN', handoffState: {},
    });

    expect(result.responseText).toMatch(/couldn't find/i);
  });

  it('answers a general dietary-advice question directly instead of misreading it as a product name search — found on a real device: "what should I eat for breakfast to get more protein" resolved to an unrelated cereal every time, because a few stopwords stripped from a full sentence still isn\'t a real food name', async () => {
    const searchSpy = vi.fn(async () => PRODUCT_OFF_RESULT);
    const ctx = makeCtx({ offClient: { searchByName: searchSpy } as never });
    const registry = new ToolRegistry();

    const result = await runNutritionAgent({
      message: 'What should I eat for breakfast to get more protein?',
      ctx, registry, locale: 'en-IN', handoffState: {},
    });

    expect(searchSpy).not.toHaveBeenCalled();
    // Personalization tools (user.profile/user.goals/memory.facts) ARE expected to be called now
    // (AI Nutrition Intelligence upgrade) — the invariant that matters is no food.search/food.lookup.
    expect(result.toolTrace.some((t) => t.tool === 'food.search' || t.tool === 'food.lookup')).toBe(false);
    expect(result.responseText).not.toMatch(/\/100/); // no product health score leaked in
  });

  it('extracts a barcode when the message contains a long digit run instead of doing a name search — product not found short-circuits before any other tool call', async () => {
    const lookupSpy = vi.fn(async () => ({ product: null, resolvedBy: 'not_found' as const }));
    const ctx = makeCtx();
    const registry = new ToolRegistry([
      { name: 'food.lookup', description: 'x', execute: lookupSpy },
    ] as never);

    const result = await runNutritionAgent({
      message: 'barcode 8901058818829', ctx, registry, locale: 'en-IN', handoffState: {},
    });

    expect(lookupSpy).toHaveBeenCalledWith({ barcode: '8901058818829' }, ctx);
    expect(result.responseText).toMatch(/couldn't find/i);
  });
});

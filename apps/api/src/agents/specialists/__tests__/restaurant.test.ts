import { describe, it, expect, vi } from 'vitest';
import { runRestaurantAgent } from '../restaurant.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

const MENU_SCAN_JSON = JSON.stringify({
  restaurantName: 'Saravana Bhavan', cuisine: 'south-indian', confidence: 0.8,
  items: [
    { name: 'Masala Dosa', description: 'Rice crepe with potato', priceRs: 120, category: 'main', isVeg: true, ingredients: ['rice', 'potato', 'oil'] },
    { name: 'Chicken 65', description: 'Fried chicken', priceRs: 220, category: 'starter', isVeg: false, ingredients: ['chicken', 'peanut oil'] },
  ],
});

function makeGateway() {
  return {
    // menu-scanner.ts's scanMenuText() always uses traceId:'menu-scan'; every other caller
    // (explainWithFallback) uses a fresh crypto.randomUUID() — this distinguishes the two
    // real gateway calls this agent makes without needing to inspect prompt text. The "explain"
    // branch echoes the real template it was given (the 2nd message) — simulating a
    // well-behaved LLM that quotes the real tool results verbatim, per its own system prompt.
    complete: vi.fn(async (req: { traceId: string; messages: Array<{ content: string }> }) => ({
      content: req.traceId === 'menu-scan' ? MENU_SCAN_JSON : req.messages[1]!.content.replace('[Real computed data]\n', ''),
      provider: 'mock', model: 'mock', promptTokens: 1, completionTokens: 1,
      costUsd: 0, latencyMs: 1, cached: false, traceId: req.traceId,
    })),
  };
}

function makeCtx(gateway: unknown): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({
          data: { display_name: 'Asha', diet_type: 'vegetarian', allergens: ['peanut'] }, error: null,
        }) }) }) };
      }
      if (table === 'user_memory_facts') {
        return { select: () => ({ eq: () => ({ gte: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    gateway: gateway as never, supabase: supabase as never, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

describe('runRestaurantAgent', () => {
  it('reports honestly when no AI gateway is configured', async () => {
    const ctx = makeCtx(null);
    const registry = new ToolRegistry();
    const result = await runRestaurantAgent({ message: 'scan this menu', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/isn't configured/i);
    expect(result.toolTrace).toHaveLength(0);
  });

  it('scans a real menu, scores items for a vegetarian user, and recommends the veg option over the non-veg one', async () => {
    const ctx = makeCtx(makeGateway());
    const registry = new ToolRegistry();

    const result = await runRestaurantAgent({
      message: 'what should I order', ctx, registry, locale: 'en-IN', handoffState: { menuText: 'menu text' },
    });

    expect(result.toolTrace.some((t) => t.tool === 'ocr.process')).toBe(true);
    expect(result.toolTrace.filter((t) => t.tool === 'restaurant.lookup')).toHaveLength(2);
    expect(result.responseText).toContain('Masala Dosa');
    expect(result.responseText).not.toContain('Chicken 65');

    // The recommended item's ingredients are re-submitted for a real allergen re-check (the
    // Output Guard's independent gate) whenever the user has any declared allergen, regardless
    // of whether that specific item happens to trigger it — never skipped just because the
    // agent's own scoring already looked "clean".
    expect(result.allergenRecheckInput).toBeDefined();
    expect(result.allergenRecheckInput!.members[0]!.allergens).toContain('peanut');
    expect(result.allergenRecheckInput!.ingredientNames).toEqual(['rice', 'potato', 'oil']);
  });
});

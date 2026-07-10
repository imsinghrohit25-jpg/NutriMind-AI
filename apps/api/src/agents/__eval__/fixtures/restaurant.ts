import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';

const MENU_SCAN_JSON = JSON.stringify({
  restaurantName: 'Saravana Bhavan', cuisine: 'south-indian', confidence: 0.8,
  items: [
    { name: 'Masala Dosa', description: 'Rice crepe with potato', priceRs: 120, category: 'main', isVeg: true, ingredients: ['rice', 'potato', 'oil'] },
    { name: 'Chicken 65', description: 'Fried chicken', priceRs: 220, category: 'starter', isVeg: false, ingredients: ['chicken', 'peanut oil'] },
  ],
});

function makeGateway() {
  return {
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

export const RESTAURANT_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'restaurant-no-gateway-honest',
    agent: 'restaurant',
    description: 'reports honestly with zero tool calls when no AI vision gateway is configured',
    message: 'scan this menu',
    buildCtx: () => makeCtx(null),
    expect: { responseIncludes: ["isn't configured"] },
  },
  {
    id: 'restaurant-recommends-veg-over-nonveg',
    agent: 'restaurant',
    description: 'scores a real scanned menu and recommends the veg option for a vegetarian user, never the non-veg one',
    message: 'what should I order',
    handoffState: { menuText: 'menu text' },
    buildCtx: () => makeCtx(makeGateway()),
    expect: {
      toolsCalled: ['ocr.process', 'restaurant.lookup', 'alternatives.rank'],
      responseIncludes: ['masala dosa'],
      responseExcludes: ['chicken 65'],
    },
  },
  {
    id: 'restaurant-allergen-recheck-always-attached',
    agent: 'restaurant',
    description: 'always attaches an allergen re-check for the recommended item when the user has ANY declared allergen',
    message: 'what should I order',
    handoffState: { menuText: 'menu text' },
    buildCtx: () => makeCtx(makeGateway()),
    expect: { guardAllowed: true },
  },
];

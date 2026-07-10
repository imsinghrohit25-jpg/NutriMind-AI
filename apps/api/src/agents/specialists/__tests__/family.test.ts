import { describe, it, expect, vi } from 'vitest';
import { runFamilyAgent } from '../family.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

const FAKE_RECIPE_JSON = JSON.stringify({
  name: 'Palak Paneer', servings: 1, cuisine: 'north-indian', dietType: 'vegetarian',
  prepTimeMin: 10, cookTimeMin: 20,
  ingredients: [{ name: 'paneer', quantity: 100, unit: 'g', gramsPerUnit: 1, totalGrams: 100 }],
  steps: [], allergens: [],
});

function makeGateway() {
  return {
    complete: vi.fn(async (req: { traceId: string; messages: Array<{ content: string }> }) => ({
      content: req.traceId === 'recipe-gen' ? FAKE_RECIPE_JSON : req.messages[1]!.content.replace('[Real computed data]\n', ''),
      provider: 'mock', model: 'mock', promptTokens: 1, completionTokens: 1, costUsd: 0, latencyMs: 1, cached: false, traceId: req.traceId,
    })),
  };
}

function makeCtx(gateway: unknown, familyRows: { groupRows: unknown[]; memberRows: unknown[]; profileRows: unknown[] }): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'family_members') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: familyRows.groupRows, error: null }),
            in: () => Promise.resolve({ data: familyRows.memberRows, error: null }),
          }),
        };
      }
      if (table === 'users_profiles') {
        return { select: () => ({ in: () => Promise.resolve({ data: familyRows.profileRows, error: null }) }) };
      }
      if (table === 'meal_plans') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'family-plan-1' }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'meal_plan_items') return { insert: () => Promise.resolve({ error: null }) };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    gateway: gateway as never, supabase: supabase as never, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

describe('runFamilyAgent', () => {
  it('reports honestly when the user has no family group', async () => {
    const ctx = makeCtx(null, { groupRows: [], memberRows: [], profileRows: [] });
    const registry = new ToolRegistry();
    const result = await runFamilyAgent({ message: 'plan meals for my family', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/not part of a family group/i);
  });

  it('reports honestly when there is a family but no AI gateway configured', async () => {
    const ctx = makeCtx(null, {
      groupRows: [{ group_id: 'g1' }],
      memberRows: [{ user_id: 'u1', role: 'owner' }, { user_id: 'u2', role: 'member' }],
      profileRows: [
        { id: 'u1', display_name: 'Asha', age_years: 35, diet_type: 'vegetarian', allergens: [] },
        { id: 'u2', display_name: 'Kiddo', age_years: 8, diet_type: 'vegetarian', allergens: ['milk'] },
      ],
    });
    const registry = new ToolRegistry();
    const result = await runFamilyAgent({ message: 'plan meals for my family', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toContain('Asha');
    expect(result.responseText).toContain('Kiddo (child)');
  });

  it('picks the most restrictive diet type and unions every member\'s allergens across the whole household', async () => {
    const gateway = makeGateway();
    const ctx = makeCtx(gateway, {
      groupRows: [{ group_id: 'g1' }],
      memberRows: [{ user_id: 'u1', role: 'owner' }, { user_id: 'u2', role: 'member' }],
      profileRows: [
        { id: 'u1', display_name: 'Asha', age_years: 35, diet_type: 'non_vegetarian', allergens: ['peanut'] },
        { id: 'u2', display_name: 'Vega', age_years: 40, diet_type: 'vegan', allergens: ['soy'] },
      ],
    });
    const registry = new ToolRegistry();

    const result = await runFamilyAgent({ message: 'plan meals for my family', ctx, registry, locale: 'en-IN', handoffState: {} });

    const genCall = gateway.complete.mock.calls.find((c) => c[0].traceId === 'recipe-gen');
    expect(genCall![0].messages[0]!.content).toContain('Diet: vegan'); // most restrictive wins
    expect(result.responseText).toContain('peanut');
    expect(result.responseText).toContain('soy');
    expect(result.handoffState).toEqual({ mealPlanId: 'family-plan-1' });
  });
});

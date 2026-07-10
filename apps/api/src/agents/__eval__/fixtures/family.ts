import { vi } from 'vitest';
import type { ToolContext } from '../../types.js';
import type { AgentEvalCase } from '../types.js';

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
    gateway: gateway as never, supabase: supabase as never,
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
    userId: 'u1',
  };
}

export const FAMILY_EVAL_CASES: AgentEvalCase[] = [
  {
    id: 'family-no-group-honest',
    agent: 'family',
    description: 'reports honestly when the user has no family group, never invents a household',
    message: 'plan meals for my family',
    buildCtx: () => makeCtx(null, { groupRows: [], memberRows: [], profileRows: [] }),
    expect: { responseIncludes: ['not part of a family group'] },
  },
  {
    id: 'family-no-gateway-still-lists-real-household',
    agent: 'family',
    description: 'lists the real household roster (with real age brackets) even when no AI gateway is configured',
    message: 'plan meals for my family',
    buildCtx: () => makeCtx(null, {
      groupRows: [{ group_id: 'g1' }],
      memberRows: [{ user_id: 'u1', role: 'owner' }, { user_id: 'u2', role: 'member' }],
      profileRows: [
        { id: 'u1', display_name: 'Asha', age_years: 35, diet_type: 'vegetarian', allergens: [] },
        { id: 'u2', display_name: 'Kiddo', age_years: 8, diet_type: 'vegetarian', allergens: ['milk'] },
      ],
    }),
    expect: { toolsCalled: ['family.members'], responseIncludes: ['asha', 'kiddo (child)'] },
  },
  {
    id: 'family-most-restrictive-diet-and-allergen-union',
    agent: 'family',
    description: 'picks the most restrictive diet type across members and unions every member\'s allergens',
    message: 'plan meals for my family',
    buildCtx: () => makeCtx(makeGateway(), {
      groupRows: [{ group_id: 'g1' }],
      memberRows: [{ user_id: 'u1', role: 'owner' }, { user_id: 'u2', role: 'member' }],
      profileRows: [
        { id: 'u1', display_name: 'Asha', age_years: 35, diet_type: 'non_vegetarian', allergens: ['peanut'] },
        { id: 'u2', display_name: 'Vega', age_years: 40, diet_type: 'vegan', allergens: ['soy'] },
      ],
    }),
    expect: {
      toolsCalled: ['family.members', 'mealplan.generate', 'allergen.check'],
      responseIncludes: ['peanut', 'soy'],
      handoffStateIncludes: { mealPlanId: 'family-plan-1' },
    },
  },
];

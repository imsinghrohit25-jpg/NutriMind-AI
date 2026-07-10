import { describe, it, expect, vi } from 'vitest';
import { runTravelNutritionAgent } from '../travel-nutrition.js';
import { ToolRegistry } from '../../tool-registry.js';
import type { ToolContext } from '../../types.js';

function makeCtx(): ToolContext {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      if (table === 'user_events') return { insert: () => Promise.resolve({ error: null }) };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return {
    supabase: supabase as never, gateway: null, userId: 'u1',
    sql: {} as never, offClient: {} as never, usdaClient: null, ifct: {} as never, cofid: {} as never,
  };
}

describe('runTravelNutritionAgent', () => {
  it('asks which country when none is detected — never guesses a destination', async () => {
    const ctx = makeCtx();
    const registry = new ToolRegistry();
    const result = await runTravelNutritionAgent({ message: 'I am traveling next week', ctx, registry, locale: 'en-IN', handoffState: {} });
    expect(result.responseText).toMatch(/which country/i);
    expect(result.toolTrace).toHaveLength(0);
  });

  it('detects a city and confirms a real, non-silent country transition', async () => {
    const ctx = makeCtx();
    const registry = new ToolRegistry();
    const result = await runTravelNutritionAgent({
      message: 'main agle hafte Dubai ja raha hoon', ctx, registry, locale: 'en-IN', handoffState: {},
    });

    expect(result.toolTrace.some((t) => t.tool === 'country.transition')).toBe(true);
    expect(result.responseText).toMatch(/switched your context/i);
    expect(result.handoffState).toEqual(expect.objectContaining({ newCountryIsoCode: 'AE' }));
  });

  it('detects a country name directly, not just a gazetteer city (Germany has no city entry, only Berlin/Munich do)', async () => {
    const ctx = makeCtx();
    const registry = new ToolRegistry();
    const result = await runTravelNutritionAgent({
      message: 'planning a trip to Germany', ctx, registry, locale: 'en-IN', handoffState: {},
    });
    expect(result.handoffState).toEqual(expect.objectContaining({ newCountryIsoCode: 'DE' }));
  });
});

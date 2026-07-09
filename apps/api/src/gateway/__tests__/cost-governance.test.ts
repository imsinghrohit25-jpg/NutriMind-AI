import { describe, it, expect, vi } from 'vitest';
import { computeDailyCostSummary, isKillSwitchActive, setKillSwitch, runCostBudgetCheck, AI_KILL_SWITCH_FLAG_KEY } from '../cost-governance.js';

function makeSql(rows: unknown[]) {
  // postgres.js's tagged-template client is callable; mimic that shape.
  return vi.fn(() => Promise.resolve(rows)) as unknown as Parameters<typeof computeDailyCostSummary>[0];
}

describe('computeDailyCostSummary', () => {
  it('sums cost, counts cache hits, and buckets by country', async () => {
    const sql = makeSql([
      { cost_usd: '0.0050', cached: false, country_code: 'IN' },
      { cost_usd: '0.0000', cached: true, country_code: 'IN' },
      { cost_usd: '0.0100', cached: false, country_code: null },
    ]);

    const summary = await computeDailyCostSummary(sql);

    expect(summary.totalCostUsd).toBeCloseTo(0.015, 6);
    expect(summary.callCount).toBe(3);
    expect(summary.cachedCount).toBe(1);
    expect(summary.cacheHitRate).toBeCloseTo(1 / 3, 6);
    expect(summary.byCountry).toEqual(expect.arrayContaining([
      { countryCode: 'IN', costUsd: 0.005 },
      { countryCode: null, costUsd: 0.01 },
    ]));
  });

  it('reports zero spend and zero hit rate with no calls today', async () => {
    const summary = await computeDailyCostSummary(makeSql([]));
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.cacheHitRate).toBe(0);
  });
});

function makeSupabase(flagRow: { enabled: boolean } | null, updateSpy = vi.fn((_patch: unknown) => Promise.resolve({ error: null }))) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data: flagRow, error: null }) }) }) }),
      update: (patch: unknown) => ({ eq: () => ({ is: () => updateSpy(patch) }) }),
    }),
  };
}

describe('isKillSwitchActive / setKillSwitch', () => {
  it('is false when the flag row is disabled', async () => {
    const supabase = makeSupabase({ enabled: false });
    expect(await isKillSwitchActive(supabase as never)).toBe(false);
  });

  it('is true when the flag row is enabled', async () => {
    const supabase = makeSupabase({ enabled: true });
    expect(await isKillSwitchActive(supabase as never)).toBe(true);
  });

  it('fails open (false) if the flag read errors, rather than fail-closed', async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: 'db down' } }) }) }) }) }),
    };
    expect(await isKillSwitchActive(supabase as never)).toBe(false);
  });

  it('setKillSwitch updates the global flag row', async () => {
    const updateSpy = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = makeSupabase({ enabled: false }, updateSpy);
    await setKillSwitch(supabase as never, true);
    expect(updateSpy).toHaveBeenCalledWith({ enabled: true });
  });
});

describe('runCostBudgetCheck', () => {
  it('engages the kill switch when spend meets the daily budget', async () => {
    const sql = makeSql([{ cost_usd: '5.00', cached: false, country_code: 'IN' }]);
    const updateSpy = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = makeSupabase({ enabled: false }, updateSpy);

    const result = await runCostBudgetCheck(sql, supabase as never, 5.0);

    expect(result.killSwitchNowActive).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({ enabled: true });
  });

  it('leaves the kill switch untouched when already in the right state', async () => {
    const sql = makeSql([{ cost_usd: '1.00', cached: false, country_code: 'IN' }]);
    const updateSpy = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = makeSupabase({ enabled: false }, updateSpy);

    const result = await runCostBudgetCheck(sql, supabase as never, 5.0);

    expect(result.killSwitchNowActive).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('exports the flag key used by the status route', () => {
    expect(AI_KILL_SWITCH_FLAG_KEY).toBe('global.p12.ai_cost_kill_switch');
  });
});

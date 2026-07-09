import { describe, it, expect, vi } from 'vitest';
import { runWeeklyReportJob, findUsersDueForWeeklyReport, lastWeekStart } from '../weekly-report.js';

vi.mock('../../../push/fcm.js', () => ({ sendPush: vi.fn(() => Promise.resolve()) }));

// Real supabase-js query builders are thenable at every step (not just after a terminal method
// like .single()/.order()) — this chain mirrors that so it works regardless of which filter
// method the production code happens to call last.
function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(resolved));
  chain.maybeSingle = vi.fn(() => Promise.resolve(resolved));
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve, reject);
  return chain;
}

describe('runWeeklyReportJob', () => {
  it('does nothing when the user logged no meals that week', async () => {
    const supabase = { from: vi.fn(() => makeChainable({ data: [] })) };
    await expect(
      runWeeklyReportJob({ userId: 'u1', weekStart: '2026-06-29', memberName: 'Asha' }, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('skips when the profile is incomplete (no crash on missing fields)', async () => {
    const mealRows = [{
      id: 'm1', logged_at: '2026-06-30T08:00:00Z', food_name: 'Poha', energy_kcal: 250,
      protein_g: 6, fat_total_g: 8, carbohydrates_g: 40, sugars_g: 5, dietary_fiber_g: 3, sodium_mg: 300,
    }];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'meal_logs') return makeChainable({ data: mealRows });
        if (table === 'users_profiles') return makeChainable({ data: null });
        return makeChainable({});
      }),
    };
    await expect(
      runWeeklyReportJob({ userId: 'u1', weekStart: '2026-06-29', memberName: 'Asha' }, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('computes a budget from users_profiles (not a non-existent daily_budget column) and sends a push', async () => {
    const { sendPush } = await import('../../../push/fcm.js');
    const mealRows = [{
      id: 'm1', logged_at: '2026-06-30T08:00:00Z', food_name: 'Poha', energy_kcal: 250,
      protein_g: 6, fat_total_g: 8, carbohydrates_g: 40, sugars_g: 5, dietary_fiber_g: 3, sodium_mg: 300,
    }];
    const profileRow = {
      weight_kg: 65, height_cm: 165, age_years: 30, biological_sex: 'female', activity_level: 'moderately_active',
    };
    const tokenRow = { fcm_token: 'token-abc' };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'meal_logs') return makeChainable({ data: mealRows });
        if (table === 'users_profiles') return makeChainable({ data: profileRow });
        if (table === 'push_tokens') return makeChainable({ data: tokenRow });
        return makeChainable({});
      }),
    };

    await runWeeklyReportJob({ userId: 'u1', weekStart: '2026-06-29', memberName: 'Asha' }, supabase as never);

    expect(sendPush).toHaveBeenCalledWith('token-abc', expect.objectContaining({
      data: expect.objectContaining({ type: 'weekly_report' }),
    }));
  });
});

describe('lastWeekStart', () => {
  it('returns the Monday of the week before the given date', () => {
    // 2026-07-09 is a Thursday
    expect(lastWeekStart(new Date('2026-07-09T12:00:00Z'))).toBe('2026-06-29');
  });
});

describe('findUsersDueForWeeklyReport', () => {
  it('returns only onboarded users who logged meals that week', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'meal_logs') return makeChainable({ data: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }] });
        if (table === 'users_profiles') return makeChainable({ data: [{ id: 'u1', display_name: 'Asha' }] });
        return makeChainable({});
      }),
    };
    const result = await findUsersDueForWeeklyReport(supabase as never, '2026-06-29');
    expect(result).toEqual([{ userId: 'u1', memberName: 'Asha' }]);
  });

  it('returns empty when nobody logged meals that week', async () => {
    const supabase = { from: vi.fn(() => makeChainable({ data: [] })) };
    const result = await findUsersDueForWeeklyReport(supabase as never, '2026-06-29');
    expect(result).toEqual([]);
  });
});

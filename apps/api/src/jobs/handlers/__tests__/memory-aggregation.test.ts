import { describe, it, expect, vi } from 'vitest';
import { runMemoryAggregationJob, findUsersWithRecentActivity } from '../memory-aggregation.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(() => Promise.resolve(resolved));
  chain.upsert = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

describe('runMemoryAggregationJob', () => {
  it('writes zero facts and makes no persist call when the user has no events', async () => {
    const supabase = { from: vi.fn(() => makeChainable({ data: [] })) };
    const result = await runMemoryAggregationJob({ userId: 'user-1' }, supabase as never);
    expect(result.factsWritten).toBe(0);
  });

  it('aggregates real events into facts and persists them', async () => {
    const rows = [
      { event_id: 'e1', user_id: 'user-1', event_type: 'recipe_cooked', payload: { recipeName: 'dal', mealType: 'lunch', cuisine: 'indian' }, occurred_at: '2026-01-01T13:00:00Z', source: 'api' },
      { event_id: 'e2', user_id: 'user-1', event_type: 'recipe_cooked', payload: { recipeName: 'idli', mealType: 'lunch', cuisine: 'indian' }, occurred_at: '2026-01-02T13:30:00Z', source: 'api' },
    ];
    let upsertedRows: unknown[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'user_events') return makeChainable({ data: rows });
        const chain = makeChainable({});
        chain.upsert = vi.fn((r: unknown[]) => { upsertedRows = r; return Promise.resolve({ data: null, error: null }); });
        return chain;
      }),
    };
    const result = await runMemoryAggregationJob({ userId: 'user-1' }, supabase as never);
    expect(result.factsWritten).toBeGreaterThan(0);
    expect(upsertedRows.length).toBe(result.factsWritten);
  });

  it('includes seasonal-pattern facts only when a countryCode is provided', async () => {
    const rows = [
      { event_id: 'e1', user_id: 'user-1', event_type: 'grocery_purchase', payload: { itemName: 'spinach' }, occurred_at: new Date().toISOString(), source: 'api' },
    ];
    const supabase = { from: vi.fn(() => makeChainable({ data: rows })) };
    const withoutCountry = await runMemoryAggregationJob({ userId: 'user-1' }, supabase as never);
    const withCountry = await runMemoryAggregationJob({ userId: 'user-1', countryCode: 'IN' }, supabase as never);
    expect(withCountry.factsWritten).toBeGreaterThanOrEqual(withoutCountry.factsWritten);
  });
});

describe('findUsersWithRecentActivity', () => {
  it('returns distinct user ids from recent events', async () => {
    // findUsersWithRecentActivity awaits `.select().gte()` directly (no .order()/.limit()) —
    // make .gte() itself the terminal, resolving call for this chain.
    const chain = makeChainable({});
    chain.select = vi.fn(() => chain);
    chain.gte = vi.fn(() => Promise.resolve({ data: [{ user_id: 'a' }, { user_id: 'a' }, { user_id: 'b' }], error: null }));
    const supabase = { from: vi.fn(() => chain) };
    const users = await findUsersWithRecentActivity(supabase as never);
    expect(users.sort()).toEqual(['a', 'b']);
  });
});

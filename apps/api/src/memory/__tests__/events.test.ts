import { describe, it, expect, vi } from 'vitest';
import { recordEvent, recordEventBestEffort, getEvents } from '../events.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.insert = vi.fn(() => Promise.resolve(resolved));
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

describe('recordEvent', () => {
  it('inserts a real row with the correct shape', async () => {
    const chain = makeChainable({});
    const supabase = { from: vi.fn(() => chain) };
    await recordEvent(supabase as never, 'user-1', 'food_logged', { foodName: 'dal' });

    expect(supabase.from).toHaveBeenCalledWith('user_events');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', event_type: 'food_logged', payload: { foodName: 'dal' } }),
    );
  });

  it('throws with a descriptive error when the insert fails', async () => {
    const supabase = { from: vi.fn(() => makeChainable({ error: { message: 'db down' } })) };
    await expect(recordEvent(supabase as never, 'user-1', 'food_logged', { foodName: 'dal' }))
      .rejects.toThrow(/db down/);
  });
});

describe('recordEventBestEffort', () => {
  it('never throws even when the underlying insert fails', () => {
    const supabase = { from: vi.fn(() => makeChainable({ error: { message: 'db down' } })) };
    expect(() => recordEventBestEffort(supabase as never, 'user-1', 'food_logged', { foodName: 'dal' })).not.toThrow();
  });
});

describe('getEvents', () => {
  it('returns the user’s own events, newest first (as ordered by the query)', async () => {
    const rows = [
      { event_id: 'e1', user_id: 'user-1', event_type: 'food_logged', payload: { foodName: 'dal' }, occurred_at: '2026-01-02T00:00:00Z', source: 'api' },
    ];
    const supabase = { from: vi.fn(() => makeChainable({ data: rows })) };
    const events = await getEvents(supabase as never, 'user-1');
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe('food_logged');
    expect(events[0]!.occurredAt).toBeInstanceOf(Date);
  });

  it('filters by eventTypes when provided', async () => {
    const chain = makeChainable({ data: [] });
    const supabase = { from: vi.fn(() => chain) };
    await getEvents(supabase as never, 'user-1', { eventTypes: ['food_logged', 'recipe_cooked'] });
    expect(chain.in).toHaveBeenCalledWith('event_type', ['food_logged', 'recipe_cooked']);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { persistFacts, getFacts, deleteFact } from '../facts-service.js';
import type { FactCandidate } from '../aggregation/types.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.upsert = vi.fn(() => Promise.resolve(resolved));
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.order = vi.fn(() => Promise.resolve(resolved));
  chain.delete = vi.fn(self);
  return chain;
}

describe('persistFacts', () => {
  it('upserts with the correct conflict target and computes valid_until from ttlDays', async () => {
    const chain = makeChainable({});
    const supabase = { from: vi.fn(() => chain) };
    const facts: FactCandidate[] = [{
      factType: 'eating_pattern', factKey: 'meal_timing_breakfast', value: { avgHourUtc: 8 },
      confidence: 0.5, derivedFrom: ['e1'], ttlDays: 60,
    }];
    const computedAt = new Date('2026-01-01T00:00:00Z');

    await persistFacts(supabase as never, 'user-1', facts, computedAt);

    expect(supabase.from).toHaveBeenCalledWith('user_memory_facts');
    expect(chain.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        user_id: 'user-1', fact_type: 'eating_pattern', fact_key: 'meal_timing_breakfast',
        valid_until: new Date('2026-03-02T00:00:00Z').toISOString(), // +60 days
      })],
      { onConflict: 'user_id,fact_type,fact_key' },
    );
  });

  it('does nothing (no DB call) when there are no facts to persist', async () => {
    const supabase = { from: vi.fn() };
    await persistFacts(supabase as never, 'user-1', []);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when the upsert fails', async () => {
    const supabase = { from: vi.fn(() => makeChainable({ error: { message: 'db down' } })) };
    const facts: FactCandidate[] = [{ factType: 'user_habit', factKey: 'x', value: {}, confidence: 1, derivedFrom: [], ttlDays: 1 }];
    await expect(persistFacts(supabase as never, 'user-1', facts)).rejects.toThrow(/db down/);
  });
});

describe('getFacts', () => {
  it('filters to active (non-decayed) facts by default', async () => {
    const chain = makeChainable({ data: [] });
    const supabase = { from: vi.fn(() => chain) };
    await getFacts(supabase as never, 'user-1');
    expect(chain.gte).toHaveBeenCalledWith('valid_until', expect.any(String));
  });

  it('skips the decay filter when activeOnly is false', async () => {
    const chain = makeChainable({ data: [] });
    const supabase = { from: vi.fn(() => chain) };
    await getFacts(supabase as never, 'user-1', { activeOnly: false });
    expect(chain.gte).not.toHaveBeenCalled();
  });

  it('maps rows to StoredMemoryFact shape', async () => {
    const rows = [{
      fact_id: 'f1', fact_type: 'eating_pattern', fact_key: 'meal_timing_breakfast',
      value: { avgHourUtc: 8 }, confidence: 0.5, derived_from: ['e1'],
      computed_at: '2026-01-01T00:00:00Z', valid_until: '2026-03-01T00:00:00Z',
    }];
    const supabase = { from: vi.fn(() => makeChainable({ data: rows })) };
    const facts = await getFacts(supabase as never, 'user-1');
    expect(facts[0]!.factId).toBe('f1');
    expect(facts[0]!.computedAt).toBeInstanceOf(Date);
  });
});

describe('deleteFact', () => {
  it('deletes scoped to both factId and userId (never another user’s fact)', async () => {
    const chain = makeChainable({});
    const supabase = { from: vi.fn(() => chain) };
    await deleteFact(supabase as never, 'user-1', 'fact-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('fact_id', 'fact-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

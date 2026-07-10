import { describe, it, expect, vi } from 'vitest';
import { alternativesRankTool } from '../alternatives.js';

function makeSupabase(facts: unknown[]) {
  return {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ gte: () => ({ order: () => Promise.resolve({ data: facts, error: null }) }) }) }),
    })),
  };
}

describe('alternativesRankTool', () => {
  it('returns every input candidate, same length — never filters (inherited contract from ranker.ts)', async () => {
    const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = await alternativesRankTool.execute(
      { candidates }, { supabase: makeSupabase([]), userId: 'u1' } as never,
    );
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ranks a cuisine-affinity match above a non-match using real stored facts', async () => {
    const facts = [{
      fact_id: 'f1', fact_type: 'regional_cuisine_affinity', fact_key: 'cuisine_affinity_vector',
      value: { affinity: { south_indian: 0.9 } }, confidence: 0.8, derived_from: [],
      computed_at: new Date().toISOString(), valid_until: new Date(Date.now() + 86400000).toISOString(),
    }];
    const result = await alternativesRankTool.execute(
      { candidates: [{ id: 'a', cuisine: 'punjabi' }, { id: 'b', cuisine: 'south_indian' }] },
      { supabase: makeSupabase(facts), userId: 'u1' } as never,
    );
    expect(result[0]!.id).toBe('b');
  });
});

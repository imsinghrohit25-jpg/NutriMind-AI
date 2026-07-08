import { describe, it, expect } from 'vitest';
import { rankRecommendations } from '../ranker.js';
import type { StoredMemoryFact } from '../facts-service.js';

function affinityFact(affinity: Record<string, number>): StoredMemoryFact {
  return {
    factId: 'f1', factType: 'regional_cuisine_affinity', factKey: 'cuisine_affinity_vector',
    value: { affinity }, confidence: 1, derivedFrom: [], computedAt: new Date(), validUntil: new Date(),
  };
}

describe('rankRecommendations', () => {
  it('never removes a candidate — output length always equals input length', () => {
    const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const ranked = rankRecommendations(candidates, []);
    expect(ranked).toHaveLength(3);
    expect(new Set(ranked.map((r) => r.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('ranks higher-affinity cuisines first', () => {
    const facts = [affinityFact({ indian: 0.8, italian: 0.2 })];
    const candidates = [{ id: 'italian-dish', cuisine: 'italian' }, { id: 'indian-dish', cuisine: 'indian' }];
    const ranked = rankRecommendations(candidates, facts);
    expect(ranked[0]!.id).toBe('indian-dish');
  });

  it('gives a seasonal-match bonus', () => {
    const candidates = [{ id: 'a', isSeasonalMatch: false }, { id: 'b', isSeasonalMatch: true }];
    const ranked = rankRecommendations(candidates, []);
    expect(ranked[0]!.id).toBe('b');
  });

  it('deprioritizes but does not remove recently-rejected candidates', () => {
    const candidates = [{ id: 'a' }, { id: 'b' }];
    const feedback = [{ recommendationId: 'a', action: 'rejected' }];
    const ranked = rankRecommendations(candidates, [], feedback);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.id).toBe('b'); // non-rejected ranks first
    expect(ranked.map((r) => r.id)).toContain('a'); // but 'a' is still present
  });

  it('is deterministic — ties break by original input order (stable sort)', () => {
    const candidates = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const ranked1 = rankRecommendations(candidates, []);
    const ranked2 = rankRecommendations(candidates, []);
    expect(ranked1.map((r) => r.id)).toEqual(ranked2.map((r) => r.id));
    expect(ranked1.map((r) => r.id)).toEqual(['x', 'y', 'z']); // all-zero scores -> stable original order
  });
});

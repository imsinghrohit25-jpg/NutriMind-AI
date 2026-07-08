// AI Memory System — Adaptive AI, deterministic ranker. Phase 11 (§12.3).
//
// This is the ONLY thing recommendation_feedback events adapt: a re-ordering of already-safe
// candidates. The ranker never decides whether a candidate is safe to show (that's the
// allergen/rule engines, upstream and untouched by this file) — it only reorders a
// pre-filtered, already-safe candidate list by affinity + seasonality + novelty. "Guardrails
// against narrowing" (§12.3): the ranker only ever changes ORDER, never REMOVES a candidate —
// see rankRecommendations()'s contract: output is always a permutation of the input, same length.

import type { StoredMemoryFact } from './facts-service.js';

export interface RankableCandidate {
  id: string;
  cuisine?: string;
  isSeasonalMatch?: boolean;
}

interface RankedCandidate extends RankableCandidate {
  score: number;
}

function cuisineAffinity(facts: StoredMemoryFact[]): Record<string, number> {
  const fact = facts.find((f) => f.factKey === 'cuisine_affinity_vector' || f.factKey === 'cuisine_frequency');
  const v = fact?.value as Record<string, unknown> | undefined;
  const dist = (v?.affinity ?? v?.distribution) as Record<string, number> | undefined;
  return dist ?? {};
}

/** Ids the user has explicitly rejected recently — deprioritized, never removed (a rejected
 *  category might still be shown lower in the list; the user controls visibility, not the
 *  ranker). */
function recentlyRejectedIds(recentFeedback: Array<{ recommendationId: string; action: string }>): Set<string> {
  return new Set(recentFeedback.filter((f) => f.action === 'rejected').map((f) => f.recommendationId));
}

/**
 * Deterministic candidate ranking: affinity (from cuisine facts) + seasonal bonus + a novelty
 * penalty for recently-rejected items. Always returns every input candidate, reordered —
 * never filters. Ties break by input order (stable sort) so the ranking is reproducible.
 */
export function rankRecommendations(
  candidates: RankableCandidate[],
  facts: StoredMemoryFact[],
  recentFeedback: Array<{ recommendationId: string; action: string }> = [],
): RankableCandidate[] {
  const affinity = cuisineAffinity(facts);
  const rejected = recentlyRejectedIds(recentFeedback);

  const scored: RankedCandidate[] = candidates.map((c) => {
    let score = 0;
    if (c.cuisine && affinity[c.cuisine] != null) score += affinity[c.cuisine]! * 10;
    if (c.isSeasonalMatch) score += 2;
    if (rejected.has(c.id)) score -= 5; // deprioritized, not removed
    return { ...c, score };
  });

  // Stable sort by score descending — Array.prototype.sort is stable per spec (ES2019+), so
  // equal scores preserve input order deterministically.
  return scored
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.score - a.c.score || a.i - b.i)
    .map(({ c }) => {
      const { score, ...rest } = c;
      void score;
      return rest;
    });
}

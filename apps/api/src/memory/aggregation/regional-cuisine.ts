// Layer 2 aggregation — regional cuisine affinity. Phase 11 (§12.2).

import type { StoredMemoryEvent } from '../events.js';
import { type FactCandidate, confidenceFromSampleSize } from './types.js';

/** Cuisine affinity vector from cooked recipes + restaurant visits — real frequency, not an
 *  LLM-guessed preference. */
export function computeCuisineAffinityFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const withCuisine = events.filter(
    (e): e is StoredMemoryEvent & { payload: { cuisine?: string } } =>
      (e.eventType === 'recipe_cooked' || e.eventType === 'restaurant_visit') && !!(e.payload as { cuisine?: string })?.cuisine,
  );
  if (withCuisine.length === 0) return null;

  const counts = new Map<string, number>();
  for (const e of withCuisine) {
    const c = e.payload.cuisine!;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const affinity = Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cuisine, n]) => [cuisine, Math.round((n / withCuisine.length) * 1000) / 1000]),
  );

  return {
    factType: 'regional_cuisine_affinity',
    factKey: 'cuisine_affinity_vector',
    value: { affinity, sampleSize: withCuisine.length },
    confidence: confidenceFromSampleSize(withCuisine.length),
    derivedFrom: withCuisine.map((e) => e.eventId),
    ttlDays: 90,
  };
}

export function computeRegionalCuisineFacts(events: StoredMemoryEvent[]): FactCandidate[] {
  return [computeCuisineAffinityFact(events)].filter((f): f is FactCandidate => f !== null);
}

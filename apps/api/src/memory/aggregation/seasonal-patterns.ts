// Layer 2 aggregation — seasonal patterns. Phase 11 (§12.2).
// Cross-references real purchased/cooked item names against the real seasonal_produce
// reference table (apps/api/src/memory/seasonal-produce-data.ts) for the user's country and
// month — string-matching against cited agricultural data, never an LLM guess at what's
// "in season."

import type { StoredMemoryEvent } from '../events.js';
import { type FactCandidate, confidenceFromSampleSize } from './types.js';

function itemNameOf(e: StoredMemoryEvent): string | null {
  if (e.eventType === 'grocery_purchase') return (e.payload as { itemName?: string }).itemName ?? null;
  if (e.eventType === 'recipe_cooked') return (e.payload as { recipeName?: string }).recipeName ?? null;
  return null;
}

/** Fraction of purchased/cooked items whose name contains a currently-in-season produce item —
 *  a real overlap computation, not an affinity the LLM invents. */
export function computeSeasonalAffinityFact(
  events: StoredMemoryEvent[],
  seasonalItemsThisMonth: readonly string[],
): FactCandidate | null {
  if (seasonalItemsThisMonth.length === 0) return null;

  const relevant = events.filter((e) => e.eventType === 'grocery_purchase' || e.eventType === 'recipe_cooked');
  if (relevant.length === 0) return null;

  const seasonalLower = seasonalItemsThisMonth.map((s) => s.toLowerCase());
  const matches: StoredMemoryEvent[] = [];
  for (const e of relevant) {
    const name = itemNameOf(e)?.toLowerCase();
    if (!name) continue;
    if (seasonalLower.some((s) => name.includes(s))) matches.push(e);
  }

  const affinityPct = Math.round((matches.length / relevant.length) * 1000) / 10;

  return {
    factType: 'seasonal_pattern',
    factKey: 'seasonal_produce_affinity',
    value: { affinityPct, matchedCount: matches.length, totalCount: relevant.length },
    confidence: confidenceFromSampleSize(relevant.length, 15),
    derivedFrom: matches.map((e) => e.eventId),
    ttlDays: 31, // seasonal — recompute roughly monthly
  };
}

export function computeSeasonalPatternFacts(
  events: StoredMemoryEvent[],
  seasonalItemsThisMonth: readonly string[],
): FactCandidate[] {
  return [computeSeasonalAffinityFact(events, seasonalItemsThisMonth)].filter((f): f is FactCandidate => f !== null);
}

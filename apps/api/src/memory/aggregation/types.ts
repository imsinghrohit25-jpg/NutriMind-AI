// AI Memory System — Layer 2 (derived profile) shared types. Phase 11 (§12.2).
// Every aggregator in this directory is a PURE function: (events) => FactCandidate[]. No I/O,
// no LLM calls, no randomness — same input events always produce the same output facts. This
// is what "derived, never divined" (§12.1) means in practice: a fact exists only because a
// deterministic statistical computation over real user_events rows produced it.

import type { StoredMemoryEvent } from '../events.js';

export type MemoryFactType =
  | 'eating_pattern'
  | 'user_habit'
  | 'health_goal'
  | 'family_preference'
  | 'regional_cuisine_affinity'
  | 'travel_history'
  | 'seasonal_pattern';

export interface FactCandidate {
  factType: MemoryFactType;
  factKey: string;
  value: Record<string, unknown>;
  /** 0–1. Reflects sample size / statistical confidence, never an LLM's self-reported certainty. */
  confidence: number;
  /** Event IDs this fact was computed from — the lineage every fact must carry (§12.1). */
  derivedFrom: string[];
  /** How long this fact should remain valid before decaying out of context assembly. */
  ttlDays: number;
}

export type Aggregator = (events: StoredMemoryEvent[]) => FactCandidate[];

/** Confidence scales with sample size, saturating at `saturatesAt` events — never a magic
 *  constant, always a function of how much real evidence backs the fact. */
export function confidenceFromSampleSize(count: number, saturatesAt = 10): number {
  if (count <= 0) return 0;
  return Math.min(1, count / saturatesAt);
}

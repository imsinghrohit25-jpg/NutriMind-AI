// Layer 2 aggregation — travel history. Phase 11 (§12.2).
// From `country_transition` events (emitted by onboarding.ts's country change endpoint) — a
// real timeline of resolved-country changes, and a `travel_mode` flag matching Phase 1's
// travel-transition UX intent (temporary context switch, auto-revert on return — the flag here
// records the fact; the auto-revert UX behavior itself lives client-side).

import type { StoredMemoryEvent } from '../events.js';
import { type FactCandidate } from './types.js';

interface CountryTransitionPayload {
  fromIsoCode?: string;
  toIsoCode: string;
}

export function computeTravelTimelineFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const transitions = events
    .filter((e): e is StoredMemoryEvent & { payload: CountryTransitionPayload } => e.eventType === 'country_transition')
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  if (transitions.length === 0) return null;

  const timeline = transitions.map((e) => ({
    isoCode: e.payload.toIsoCode,
    since: e.occurredAt.toISOString(),
  }));

  // "Traveling" if there have been 2+ distinct countries in the last 30 days — a real,
  // computable signal, not a guess.
  const recent = transitions.filter((e) => Date.now() - e.occurredAt.getTime() < 30 * 86_400_000);
  const distinctRecentCountries = new Set(recent.map((e) => e.payload.toIsoCode));
  const travelMode = distinctRecentCountries.size >= 2;

  return {
    factType: 'travel_history',
    factKey: 'travel_timeline',
    value: { timeline, currentIsoCode: timeline[timeline.length - 1]!.isoCode, travelMode },
    confidence: 1, // each entry is a real recorded transition, not an estimate
    derivedFrom: transitions.map((e) => e.eventId),
    ttlDays: 180,
  };
}

export function computeTravelHistoryFacts(events: StoredMemoryEvent[]): FactCandidate[] {
  return [computeTravelTimelineFact(events)].filter((f): f is FactCandidate => f !== null);
}

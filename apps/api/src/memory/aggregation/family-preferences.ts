// Layer 2 aggregation — family preferences. Phase 11 (§12.2).
// Scope note (ADR-0025): `user_events` is scoped to the authenticated account, not to individual
// household members — there is no per-member-attributed event in this schema (that would
// require member-tagged logging UI this build doesn't have). What IS real and computable: the
// account's own cooked/planned diet-type distribution, which — since NutriMind meal plans and
// recipes serve the whole household by design (household_members, ADR-0014) — is a legitimate
// proxy for "what this family typically eats." Per-member preference splitting is a named,
// tracked gap, not fabricated here.

import type { StoredMemoryEvent } from '../events.js';
import { type FactCandidate, confidenceFromSampleSize } from './types.js';

export function computeHouseholdDietTypeFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const withDietType = events.filter(
    (e): e is StoredMemoryEvent & { payload: { dietType?: string } } =>
      (e.eventType === 'recipe_cooked' || e.eventType === 'meal_planned') && !!(e.payload as { dietType?: string })?.dietType,
  );
  if (withDietType.length === 0) return null;

  const counts = new Map<string, number>();
  for (const e of withDietType) {
    const dt = e.payload.dietType!;
    counts.set(dt, (counts.get(dt) ?? 0) + 1);
  }
  const distribution = Object.fromEntries(
    [...counts.entries()].map(([dt, n]) => [dt, Math.round((n / withDietType.length) * 1000) / 1000]),
  );

  return {
    factType: 'family_preference',
    factKey: 'household_diet_type_distribution',
    value: { distribution, sampleSize: withDietType.length },
    confidence: confidenceFromSampleSize(withDietType.length),
    derivedFrom: withDietType.map((e) => e.eventId),
    ttlDays: 90,
  };
}

export function computeFamilyPreferenceFacts(events: StoredMemoryEvent[]): FactCandidate[] {
  return [computeHouseholdDietTypeFact(events)].filter((f): f is FactCandidate => f !== null);
}

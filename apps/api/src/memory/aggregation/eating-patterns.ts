// Layer 2 aggregation — eating patterns. Phase 11 (§12.2).
// Computed from `recipe_cooked` events (the real "this meal actually happened" signal — see
// ADR-0025 for why `food_logged` isn't used: no route emits it yet, no free-text meal-logging
// endpoint exists in this build).

import type { StoredMemoryEvent } from '../events.js';
import { type FactCandidate, confidenceFromSampleSize } from './types.js';

interface RecipeCookedPayload {
  recipeName: string;
  cuisine?: string;
  dietType?: string;
  mealType?: string;
}

function isRecipeCooked(e: StoredMemoryEvent): e is StoredMemoryEvent & { payload: RecipeCookedPayload } {
  return e.eventType === 'recipe_cooked';
}

/** Average hour-of-day (0–23, local to occurredAt's UTC offset as stored) each meal type
 *  happens at, from real completion timestamps. */
export function computeMealTimingFacts(events: StoredMemoryEvent[]): FactCandidate[] {
  const cooked = events.filter(isRecipeCooked);
  const byMealType = new Map<string, StoredMemoryEvent[]>();
  for (const e of cooked) {
    const mealType = e.payload.mealType;
    if (!mealType) continue;
    const list = byMealType.get(mealType) ?? [];
    list.push(e);
    byMealType.set(mealType, list);
  }

  const facts: FactCandidate[] = [];
  for (const [mealType, mealEvents] of byMealType) {
    const avgHour = mealEvents.reduce((sum, e) => sum + e.occurredAt.getUTCHours(), 0) / mealEvents.length;
    facts.push({
      factType: 'eating_pattern',
      factKey: `meal_timing_${mealType}`,
      value: { avgHourUtc: Math.round(avgHour * 10) / 10, sampleSize: mealEvents.length },
      confidence: confidenceFromSampleSize(mealEvents.length),
      derivedFrom: mealEvents.map((e) => e.eventId),
      ttlDays: 60,
    });
  }
  return facts;
}

/** Cuisine frequency distribution, from cuisines actually cooked. */
export function computeCuisineFrequencyFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const cooked = events.filter(isRecipeCooked).filter((e) => e.payload.cuisine);
  if (cooked.length === 0) return null;

  const counts = new Map<string, number>();
  for (const e of cooked) {
    const cuisine = e.payload.cuisine!;
    counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
  }
  const distribution = Object.fromEntries(
    [...counts.entries()].map(([cuisine, n]) => [cuisine, Math.round((n / cooked.length) * 1000) / 1000]),
  );

  return {
    factType: 'eating_pattern',
    factKey: 'cuisine_frequency',
    value: { distribution, sampleSize: cooked.length },
    confidence: confidenceFromSampleSize(cooked.length),
    derivedFrom: cooked.map((e) => e.eventId),
    ttlDays: 60,
  };
}

/** Weekday vs. weekend cooking-frequency delta — a real, computable proxy for "eats differently
 *  on weekends" without needing per-event kcal data this event schema doesn't carry. */
export function computeWeekdayWeekendDeltaFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const cooked = events.filter(isRecipeCooked);
  if (cooked.length < 4) return null; // too few data points for a meaningful weekday/weekend split

  let weekdayCount = 0;
  let weekendCount = 0;
  for (const e of cooked) {
    const day = e.occurredAt.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) weekendCount++;
    else weekdayCount++;
  }

  const weekdayRate = weekdayCount / 5; // per weekday
  const weekendRate = weekendCount / 2; // per weekend day
  const deltaPct = weekdayRate > 0 ? Math.round(((weekendRate - weekdayRate) / weekdayRate) * 1000) / 10 : 0;

  return {
    factType: 'eating_pattern',
    factKey: 'weekday_weekend_delta',
    value: { weekdayCount, weekendCount, weekendVsWeekdayDeltaPct: deltaPct },
    confidence: confidenceFromSampleSize(cooked.length, 20),
    derivedFrom: cooked.map((e) => e.eventId),
    ttlDays: 60,
  };
}

export function computeEatingPatternFacts(events: StoredMemoryEvent[]): FactCandidate[] {
  const facts = [
    ...computeMealTimingFacts(events),
    computeCuisineFrequencyFact(events),
    computeWeekdayWeekendDeltaFact(events),
  ];
  return facts.filter((f): f is FactCandidate => f !== null);
}

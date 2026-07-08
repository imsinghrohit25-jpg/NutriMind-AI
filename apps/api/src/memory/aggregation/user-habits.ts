// Layer 2 aggregation — user habits. Phase 11 (§12.2).

import type { StoredMemoryEvent } from '../events.js';
import { type FactCandidate, confidenceFromSampleSize } from './types.js';

/** Median days between consecutive events of any type — a real measure of how often the user
 *  actively engages with the app at all. */
export function computeLoggingCadenceFact(events: StoredMemoryEvent[]): FactCandidate | null {
  if (events.length < 3) return null;

  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const gapsDays: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gapMs = sorted[i]!.occurredAt.getTime() - sorted[i - 1]!.occurredAt.getTime();
    gapsDays.push(gapMs / 86_400_000);
  }
  gapsDays.sort((a, b) => a - b);
  const median = gapsDays[Math.floor(gapsDays.length / 2)]!;

  return {
    factType: 'user_habit',
    factKey: 'logging_cadence',
    value: { medianDaysBetweenEvents: Math.round(median * 100) / 100, sampleSize: events.length },
    confidence: confidenceFromSampleSize(events.length, 20),
    derivedFrom: sorted.map((e) => e.eventId),
    ttlDays: 30,
  };
}

/** Barcode-scan engagement rate — real count/frequency, not a fabricated "vs. search"
 *  comparison (this build has no user-attributed name-search event to compare against; see
 *  ADR-0025 for the honest scope note). */
export function computeScanFrequencyFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const scans = events.filter((e) => e.eventType === 'barcode_scanned');
  if (scans.length === 0) return null;

  return {
    factType: 'user_habit',
    factKey: 'scan_frequency',
    value: { scanCount: scans.length },
    confidence: confidenceFromSampleSize(scans.length, 15),
    derivedFrom: scans.map((e) => e.eventId),
    ttlDays: 30,
  };
}

/** Snacking window — hours of day snack-type meals are cooked/planned. */
export function computeSnackingWindowFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const snackEvents = events.filter(
    (e): e is StoredMemoryEvent & { payload: { mealType?: string } } =>
      (e.eventType === 'recipe_cooked' || e.eventType === 'meal_planned') &&
      (e.payload as { mealType?: string } | undefined)?.mealType === 'snack',
  );
  if (snackEvents.length === 0) return null;

  const hours = snackEvents.map((e) => e.occurredAt.getUTCHours());
  const avgHour = hours.reduce((s, h) => s + h, 0) / hours.length;

  return {
    factType: 'user_habit',
    factKey: 'snacking_window',
    value: { avgHourUtc: Math.round(avgHour * 10) / 10, sampleSize: snackEvents.length },
    confidence: confidenceFromSampleSize(snackEvents.length),
    derivedFrom: snackEvents.map((e) => e.eventId),
    ttlDays: 45,
  };
}

export function computeUserHabitFacts(events: StoredMemoryEvent[]): FactCandidate[] {
  return [
    computeLoggingCadenceFact(events),
    computeScanFrequencyFact(events),
    computeSnackingWindowFact(events),
  ].filter((f): f is FactCandidate => f !== null);
}

// Layer 2 aggregation — health goals. Phase 11 (§12.2).
// Plateau detection is real linear-regression trend analysis over biomarker_reading events —
// "statistical, not LLM" per §12.2's explicit requirement.

import type { StoredMemoryEvent } from '../events.js';
import { type FactCandidate, confidenceFromSampleSize } from './types.js';
import { computeOlsRegression } from '../../stats/linear-regression.js';

/** The most recently set goal. */
export function computeActiveGoalFact(events: StoredMemoryEvent[]): FactCandidate | null {
  const goalEvents = events
    .filter((e): e is StoredMemoryEvent & { payload: { goal: string; kcalTarget?: number } } => e.eventType === 'goal_set')
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  if (goalEvents.length === 0) return null;

  const latest = goalEvents[0]!;
  return {
    factType: 'health_goal',
    factKey: 'active_goal',
    value: { goal: latest.payload.goal, kcalTarget: latest.payload.kcalTarget ?? null, setAt: latest.occurredAt.toISOString() },
    confidence: 1, // a single explicit user action, not a statistical inference
    derivedFrom: [latest.eventId],
    ttlDays: 90,
  };
}

/** Current consecutive-day streak of at least one `recipe_cooked` event — a real streak
 *  computed from actual completion timestamps, never an LLM-estimated number. */
export function computeStreakFact(events: StoredMemoryEvent[], asOf: Date = new Date()): FactCandidate | null {
  const cooked = events.filter((e) => e.eventType === 'recipe_cooked');
  if (cooked.length === 0) return null;

  const daysWithActivity = new Set(cooked.map((e) => e.occurredAt.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  while (daysWithActivity.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  if (streak === 0) return null;

  return {
    factType: 'health_goal',
    factKey: 'current_streak_days',
    value: { streakDays: streak },
    confidence: 1,
    derivedFrom: cooked.map((e) => e.eventId),
    ttlDays: 1, // a streak fact is only meaningful for ~today; recompute daily
  };
}

/** Adherence rate over the trailing window: % of days with at least one `recipe_cooked` event. */
export function computeAdherenceRateFact(events: StoredMemoryEvent[], windowDays = 14, asOf: Date = new Date()): FactCandidate | null {
  const cooked = events.filter((e) => e.eventType === 'recipe_cooked');
  if (cooked.length === 0) return null;

  const windowStart = new Date(asOf.getTime() - windowDays * 86_400_000);
  const inWindow = cooked.filter((e) => e.occurredAt >= windowStart && e.occurredAt <= asOf);
  const daysWithActivity = new Set(inWindow.map((e) => e.occurredAt.toISOString().slice(0, 10))).size;
  const adherencePct = Math.round((daysWithActivity / windowDays) * 1000) / 10;

  return {
    factType: 'health_goal',
    factKey: 'adherence_rate',
    value: { windowDays, daysWithActivity, adherencePct },
    confidence: confidenceFromSampleSize(inWindow.length, windowDays),
    derivedFrom: inWindow.map((e) => e.eventId),
    ttlDays: 14,
  };
}

/** Plateau detection via ordinary least-squares linear regression over `biomarker_reading`
 *  events for a weight-like biomarker — a near-zero slope over enough readings is a plateau.
 *  Pure statistics; the LLM never sees or estimates this number. */
export function computePlateauFact(events: StoredMemoryEvent[], biomarkerType = 'weight'): FactCandidate | null {
  const readings = events
    .filter((e): e is StoredMemoryEvent & { payload: { biomarkerType: string; value: number; unit: string } } =>
      e.eventType === 'biomarker_reading' && (e.payload as { biomarkerType?: string })?.biomarkerType === biomarkerType)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (readings.length < 4) return null; // need enough points for a meaningful trend

  const t0 = readings[0]!.occurredAt.getTime();
  const { slope: slopePerDay, sampleSize: n } = computeOlsRegression(
    readings.map((r) => ({
      x: (r.occurredAt.getTime() - t0) / 86_400_000, // days since first reading
      y: r.payload.value,
    })),
  );
  const slopePerWeek = slopePerDay * 7;

  // Plateau threshold: less than 0.1 unit/week of movement over a real multi-reading trend.
  const isPlateau = Math.abs(slopePerWeek) < 0.1;

  return {
    factType: 'health_goal',
    factKey: `plateau_${biomarkerType}`,
    value: { slopePerWeek: Math.round(slopePerWeek * 1000) / 1000, isPlateau, sampleSize: n },
    confidence: confidenceFromSampleSize(n, 8),
    derivedFrom: readings.map((r) => r.eventId),
    ttlDays: 21,
  };
}

export function computeHealthGoalFacts(events: StoredMemoryEvent[], asOf: Date = new Date()): FactCandidate[] {
  return [
    computeActiveGoalFact(events),
    computeStreakFact(events, asOf),
    computeAdherenceRateFact(events, 14, asOf),
    computePlateauFact(events, 'weight'),
  ].filter((f): f is FactCandidate => f !== null);
}

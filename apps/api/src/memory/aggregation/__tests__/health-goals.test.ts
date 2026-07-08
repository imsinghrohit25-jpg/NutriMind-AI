import { describe, it, expect } from 'vitest';
import { computeActiveGoalFact, computeStreakFact, computeAdherenceRateFact, computePlateauFact } from '../health-goals.js';
import type { StoredMemoryEvent } from '../../events.js';

function event(overrides: Partial<StoredMemoryEvent>): StoredMemoryEvent {
  return {
    eventId: overrides.eventId ?? Math.random().toString(36),
    userId: 'user-1',
    eventType: 'goal_set',
    payload: {},
    occurredAt: new Date('2026-01-05T08:00:00Z'),
    source: 'api',
    ...overrides,
  };
}

describe('computeActiveGoalFact', () => {
  it('picks the most recently set goal', () => {
    const events = [
      event({ payload: { goal: 'lose' }, occurredAt: new Date('2026-01-01T00:00:00Z') }),
      event({ payload: { goal: 'maintain' }, occurredAt: new Date('2026-01-10T00:00:00Z') }),
    ];
    const fact = computeActiveGoalFact(events)!;
    expect(fact.value.goal).toBe('maintain');
    expect(fact.confidence).toBe(1);
  });
});

describe('computeStreakFact', () => {
  it('counts consecutive days ending at asOf with at least one recipe_cooked event', () => {
    const asOf = new Date('2026-01-05T12:00:00Z');
    const events = [
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'a' }, occurredAt: new Date('2026-01-05T08:00:00Z') }),
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'b' }, occurredAt: new Date('2026-01-04T08:00:00Z') }),
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'c' }, occurredAt: new Date('2026-01-03T08:00:00Z') }),
      // gap on 01-02 breaks the streak
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'd' }, occurredAt: new Date('2026-01-01T08:00:00Z') }),
    ];
    const fact = computeStreakFact(events, asOf)!;
    expect(fact.value.streakDays).toBe(3);
  });

  it('returns null when there is no activity today', () => {
    const asOf = new Date('2026-01-10T12:00:00Z');
    const events = [event({ eventType: 'recipe_cooked', payload: { recipeName: 'a' }, occurredAt: new Date('2026-01-01T08:00:00Z') })];
    expect(computeStreakFact(events, asOf)).toBeNull();
  });
});

describe('computeAdherenceRateFact', () => {
  it('computes the real percentage of days-with-activity in the trailing window', () => {
    const asOf = new Date('2026-01-14T12:00:00Z');
    const events = [
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'a' }, occurredAt: new Date('2026-01-05T08:00:00Z') }),
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'b' }, occurredAt: new Date('2026-01-07T08:00:00Z') }),
    ];
    const fact = computeAdherenceRateFact(events, 14, asOf)!;
    expect(fact.value.daysWithActivity).toBe(2);
    expect(fact.value.adherencePct).toBeCloseTo((2 / 14) * 100, 1);
  });
});

describe('computePlateauFact', () => {
  it('needs at least 4 weight readings', () => {
    const events = [
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 70, unit: 'kg' } }),
    ];
    expect(computePlateauFact(events)).toBeNull();
  });

  it('detects a plateau via real linear regression when weight barely moves', () => {
    const events = [
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 70.0, unit: 'kg' }, occurredAt: new Date('2026-01-01T00:00:00Z') }),
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 70.05, unit: 'kg' }, occurredAt: new Date('2026-01-08T00:00:00Z') }),
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 69.98, unit: 'kg' }, occurredAt: new Date('2026-01-15T00:00:00Z') }),
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 70.02, unit: 'kg' }, occurredAt: new Date('2026-01-22T00:00:00Z') }),
    ];
    const fact = computePlateauFact(events)!;
    expect(fact.value.isPlateau).toBe(true);
  });

  it('does not detect a plateau when weight is trending consistently', () => {
    const events = [
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 75, unit: 'kg' }, occurredAt: new Date('2026-01-01T00:00:00Z') }),
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 74, unit: 'kg' }, occurredAt: new Date('2026-01-08T00:00:00Z') }),
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 73, unit: 'kg' }, occurredAt: new Date('2026-01-15T00:00:00Z') }),
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'weight', value: 72, unit: 'kg' }, occurredAt: new Date('2026-01-22T00:00:00Z') }),
    ];
    const fact = computePlateauFact(events)!;
    expect(fact.value.isPlateau).toBe(false);
    expect(fact.value.slopePerWeek).toBeLessThan(0); // real downward trend
  });

  it('only considers the requested biomarkerType', () => {
    const events = [
      event({ eventType: 'biomarker_reading', payload: { biomarkerType: 'hba1c', value: 5.4, unit: '%' } }),
    ];
    expect(computePlateauFact(events, 'weight')).toBeNull();
  });
});

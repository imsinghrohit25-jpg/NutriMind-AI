import { describe, it, expect } from 'vitest';
import { computeMealTimingFacts, computeCuisineFrequencyFact, computeWeekdayWeekendDeltaFact } from '../eating-patterns.js';
import type { StoredMemoryEvent } from '../../events.js';

function event(overrides: Partial<StoredMemoryEvent>): StoredMemoryEvent {
  return {
    eventId: overrides.eventId ?? Math.random().toString(36),
    userId: 'user-1',
    eventType: 'recipe_cooked',
    payload: {},
    occurredAt: new Date('2026-01-05T08:00:00Z'), // a Monday
    source: 'api',
    ...overrides,
  };
}

describe('computeMealTimingFacts', () => {
  it('computes the average hour per meal type from real timestamps', () => {
    const events = [
      event({ eventId: 'e1', payload: { recipeName: 'Poha', mealType: 'breakfast' }, occurredAt: new Date('2026-01-01T08:00:00Z') }),
      event({ eventId: 'e2', payload: { recipeName: 'Idli', mealType: 'breakfast' }, occurredAt: new Date('2026-01-02T09:00:00Z') }),
    ];
    const facts = computeMealTimingFacts(events);
    const breakfast = facts.find((f) => f.factKey === 'meal_timing_breakfast')!;
    expect(breakfast.value.avgHourUtc).toBe(8.5);
    expect(breakfast.derivedFrom).toEqual(['e1', 'e2']);
  });

  it('ignores events with no mealType and returns nothing for empty input', () => {
    expect(computeMealTimingFacts([event({ payload: { recipeName: 'x' } })])).toEqual([]);
    expect(computeMealTimingFacts([])).toEqual([]);
  });

  it('confidence scales with sample size', () => {
    const one = computeMealTimingFacts([event({ payload: { recipeName: 'x', mealType: 'lunch' } })]);
    const ten = computeMealTimingFacts(
      Array.from({ length: 10 }, (_, i) => event({ eventId: `e${i}`, payload: { recipeName: 'x', mealType: 'lunch' } })),
    );
    expect(one[0]!.confidence).toBeLessThan(ten[0]!.confidence);
    expect(ten[0]!.confidence).toBe(1);
  });
});

describe('computeCuisineFrequencyFact', () => {
  it('computes a real frequency distribution summing to 1', () => {
    const events = [
      event({ payload: { recipeName: 'a', cuisine: 'indian' } }),
      event({ payload: { recipeName: 'b', cuisine: 'indian' } }),
      event({ payload: { recipeName: 'c', cuisine: 'italian' } }),
    ];
    const fact = computeCuisineFrequencyFact(events)!;
    expect(fact.value.distribution).toEqual({ indian: 0.667, italian: 0.333 });
  });

  it('returns null when no events carry a cuisine', () => {
    expect(computeCuisineFrequencyFact([event({ payload: { recipeName: 'x' } })])).toBeNull();
  });
});

describe('computeWeekdayWeekendDeltaFact', () => {
  it('requires at least 4 events to avoid a noisy conclusion', () => {
    const few = [event({}), event({})];
    expect(computeWeekdayWeekendDeltaFact(few)).toBeNull();
  });

  it('computes a real weekday/weekend split from actual day-of-week', () => {
    const events = [
      event({ occurredAt: new Date('2026-01-05T08:00:00Z') }), // Monday
      event({ occurredAt: new Date('2026-01-06T08:00:00Z') }), // Tuesday
      event({ occurredAt: new Date('2026-01-03T08:00:00Z') }), // Saturday
      event({ occurredAt: new Date('2026-01-04T08:00:00Z') }), // Sunday
    ];
    const fact = computeWeekdayWeekendDeltaFact(events)!;
    expect(fact.value.weekdayCount).toBe(2);
    expect(fact.value.weekendCount).toBe(2);
  });
});

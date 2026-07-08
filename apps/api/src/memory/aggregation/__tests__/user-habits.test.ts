import { describe, it, expect } from 'vitest';
import { computeLoggingCadenceFact, computeScanFrequencyFact, computeSnackingWindowFact } from '../user-habits.js';
import type { StoredMemoryEvent } from '../../events.js';

function event(overrides: Partial<StoredMemoryEvent>): StoredMemoryEvent {
  return {
    eventId: overrides.eventId ?? Math.random().toString(36),
    userId: 'user-1',
    eventType: 'barcode_scanned',
    payload: {},
    occurredAt: new Date('2026-01-05T08:00:00Z'),
    source: 'api',
    ...overrides,
  };
}

describe('computeLoggingCadenceFact', () => {
  it('needs at least 3 events', () => {
    expect(computeLoggingCadenceFact([event({}), event({})])).toBeNull();
  });

  it('computes the real median gap between consecutive events', () => {
    const events = [
      event({ occurredAt: new Date('2026-01-01T00:00:00Z') }),
      event({ occurredAt: new Date('2026-01-03T00:00:00Z') }), // +2 days
      event({ occurredAt: new Date('2026-01-10T00:00:00Z') }), // +7 days
    ];
    const fact = computeLoggingCadenceFact(events)!;
    expect(fact.value.medianDaysBetweenEvents).toBe(7); // median of [2, 7] with even count -> index 1
  });
});

describe('computeScanFrequencyFact', () => {
  it('counts barcode_scanned events only', () => {
    const events = [
      event({ eventType: 'barcode_scanned' }),
      event({ eventType: 'barcode_scanned' }),
      event({ eventType: 'grocery_purchase', payload: { itemName: 'rice' } }),
    ];
    const fact = computeScanFrequencyFact(events)!;
    expect(fact.value.scanCount).toBe(2);
  });

  it('returns null when there are no scans', () => {
    expect(computeScanFrequencyFact([event({ eventType: 'grocery_purchase', payload: { itemName: 'rice' } })])).toBeNull();
  });
});

describe('computeSnackingWindowFact', () => {
  it('computes the average hour of snack-type meals only', () => {
    const events = [
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'chips', mealType: 'snack' }, occurredAt: new Date('2026-01-01T16:00:00Z') }),
      event({ eventType: 'recipe_cooked', payload: { recipeName: 'dal', mealType: 'lunch' }, occurredAt: new Date('2026-01-01T13:00:00Z') }),
    ];
    const fact = computeSnackingWindowFact(events)!;
    expect(fact.value.avgHourUtc).toBe(16);
    expect(fact.value.sampleSize).toBe(1);
  });
});

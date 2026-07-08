import { describe, it, expect } from 'vitest';
import { computeHouseholdDietTypeFact } from '../family-preferences.js';
import { computeCuisineAffinityFact } from '../regional-cuisine.js';
import { computeTravelTimelineFact } from '../travel-history.js';
import { computeSeasonalAffinityFact } from '../seasonal-patterns.js';
import type { StoredMemoryEvent } from '../../events.js';

function event(overrides: Partial<StoredMemoryEvent>): StoredMemoryEvent {
  return {
    eventId: overrides.eventId ?? Math.random().toString(36),
    userId: 'user-1',
    eventType: 'recipe_cooked',
    payload: {},
    occurredAt: new Date('2026-01-05T08:00:00Z'),
    source: 'api',
    ...overrides,
  };
}

describe('computeHouseholdDietTypeFact', () => {
  it('computes a real diet-type distribution from cooked/planned meals', () => {
    const events = [
      event({ payload: { recipeName: 'a', dietType: 'vegetarian' } }),
      event({ payload: { recipeName: 'b', dietType: 'vegetarian' } }),
      event({ eventType: 'meal_planned', payload: { planId: 'p1', mealType: 'lunch', dietType: 'vegan' } as never }),
    ];
    const fact = computeHouseholdDietTypeFact(events)!;
    expect(fact.value.distribution).toEqual({ vegetarian: 0.667, vegan: 0.333 });
  });

  it('returns null with no dietType data', () => {
    expect(computeHouseholdDietTypeFact([event({ payload: { recipeName: 'x' } })])).toBeNull();
  });
});

describe('computeCuisineAffinityFact', () => {
  it('ranks cuisines by real frequency, most-affine first', () => {
    const events = [
      event({ payload: { recipeName: 'a', cuisine: 'indian' } }),
      event({ payload: { recipeName: 'b', cuisine: 'indian' } }),
      event({ eventType: 'restaurant_visit', payload: { cuisine: 'thai' } }),
    ];
    const fact = computeCuisineAffinityFact(events)!;
    const keys = Object.keys(fact.value.affinity as Record<string, number>);
    expect(keys[0]).toBe('indian'); // highest frequency first
  });
});

describe('computeTravelTimelineFact', () => {
  it('builds a real chronological timeline from country_transition events', () => {
    const events = [
      event({ eventType: 'country_transition', payload: { toIsoCode: 'GB' }, occurredAt: new Date('2026-01-10T00:00:00Z') }),
      event({ eventType: 'country_transition', payload: { fromIsoCode: 'IN', toIsoCode: 'IN' }, occurredAt: new Date('2026-01-01T00:00:00Z') }),
    ];
    const fact = computeTravelTimelineFact(events)!;
    expect((fact.value.timeline as unknown[]).length).toBe(2);
    expect(fact.value.currentIsoCode).toBe('GB'); // most recent
  });

  it('flags travelMode when 2+ distinct countries in the last 30 days', () => {
    const now = new Date();
    const events = [
      event({ eventType: 'country_transition', payload: { toIsoCode: 'IN' }, occurredAt: new Date(now.getTime() - 5 * 86_400_000) }),
      event({ eventType: 'country_transition', payload: { toIsoCode: 'GB' }, occurredAt: now }),
    ];
    const fact = computeTravelTimelineFact(events)!;
    expect(fact.value.travelMode).toBe(true);
  });
});

describe('computeSeasonalAffinityFact', () => {
  it('computes real overlap between purchased items and the seasonal produce list', () => {
    const events = [
      event({ eventType: 'grocery_purchase', payload: { itemName: 'Fresh Spinach' } }),
      event({ eventType: 'grocery_purchase', payload: { itemName: 'Frozen Pizza' } }),
    ];
    const fact = computeSeasonalAffinityFact(events, ['spinach', 'carrot'])!;
    expect(fact.value.matchedCount).toBe(1);
    expect(fact.value.affinityPct).toBe(50);
  });

  it('returns null when no seasonal reference data is provided (never fabricates a list)', () => {
    expect(computeSeasonalAffinityFact([event({ eventType: 'grocery_purchase', payload: { itemName: 'x' } })], [])).toBeNull();
  });
});

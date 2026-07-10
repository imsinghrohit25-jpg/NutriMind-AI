import { describe, it, expect } from 'vitest';
import { computeTurnWeight, AGENT_DAILY_TURN_BUDGET } from '../cost-budget.js';

describe('computeTurnWeight', () => {
  it('charges a voice-classified plan double', () => {
    expect(computeTurnWeight(['voice'])).toBe(2);
  });

  it('charges a voice-classified plan double even when it cascades to other agents', () => {
    expect(computeTurnWeight(['voice', 'nutrition'])).toBe(2);
  });

  it('charges every other agent plan a single unit', () => {
    expect(computeTurnWeight(['nutrition'])).toBe(1);
    expect(computeTurnWeight(['travel_nutrition', 'meal_planning', 'grocery'])).toBe(1);
  });

  it('charges an empty plan a single unit, never zero', () => {
    expect(computeTurnWeight([])).toBe(1);
  });
});

describe('AGENT_DAILY_TURN_BUDGET', () => {
  it('is a positive, real number', () => {
    expect(AGENT_DAILY_TURN_BUDGET).toBeGreaterThan(0);
  });
});

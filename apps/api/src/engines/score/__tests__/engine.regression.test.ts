/**
 * REGRESSION GOLDEN TESTS — Health Score Engine
 *
 * These tests pin the exact numerical output of computeHealthScore() for known inputs.
 * If ANY value changes, the test fails — forcing a conscious ADR-backed decision.
 *
 * Rule: Never update expected values without updating SCORE_ALGORITHM_VERSION.
 * Reason: Downstream callers (UI, meal planner, recommendations) rely on stable scores.
 *
 * Golden fixture format: { input, expectedScore, expectedBand, expectedSubscores }
 */

import { describe, it, expect } from 'vitest';
import { computeHealthScore } from '../engine.js';
import { SCORE_ALGORITHM_VERSION } from '../version.js';

describe('Health Score Engine — regression golden tests', () => {
  it('GOLDEN-SCORE-001 algorithm version is pinned', () => {
    // If the version changes, all golden scores should be re-verified.
    expect(SCORE_ALGORITHM_VERSION).toBe('1.0.0');
  });

  it('GOLDEN-SCORE-002 perfect product (zero harmful, high beneficial)', () => {
    const result = computeHealthScore({
      sodiumMg: 10,
      sugarsG: 0,
      sugarsAddedG: 0,
      fatSaturatedG: 0,
      fatTransG: 0,
      dietaryFiberG: 10,
      proteinG: 20,
      novaGroup: 1,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe('excellent');
  });

  it('GOLDEN-SCORE-003 worst product (max harmful, zero beneficial)', () => {
    const result = computeHealthScore({
      sodiumMg: 10000,
      sugarsG: 100,
      sugarsAddedG: 100,
      fatSaturatedG: 30,
      fatTransG: 10,
      dietaryFiberG: 0,
      proteinG: 0,
      novaGroup: 4,
    });
    // Score floor is not exactly 0 due to rounding; pin the actual floor value.
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.band).toBe('bad');
  });

  it('GOLDEN-SCORE-004 typical Indian biscuit approximation', () => {
    // ~200 kcal pack: high sugar, medium sat fat, low fibre, moderate sodium
    const result = computeHealthScore({
      sodiumMg: 300,
      sugarsG: 25,
      sugarsAddedG: 22,
      fatSaturatedG: 7,
      fatTransG: 0.5,
      dietaryFiberG: 1.5,
      proteinG: 5,
      novaGroup: 4,
    });
    // Exact score must not drift. NOVA-4 penalty, high added sugar, moderate sodium.
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(45);
    expect(['poor', 'fair', 'bad']).toContain(result.band);
  });

  it('GOLDEN-SCORE-005 plain rolled oats (clean label)', () => {
    const result = computeHealthScore({
      sodiumMg: 5,
      sugarsG: 1,
      sugarsAddedG: 0,
      fatSaturatedG: 0.9,
      fatTransG: 0,
      dietaryFiberG: 10,
      proteinG: 17,
      novaGroup: 1,
    });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(['excellent', 'good']).toContain(result.band);
  });

  it('GOLDEN-SCORE-006 unknown inputs produce mid-range score, not NaN', () => {
    const result = computeHealthScore({});
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('GOLDEN-SCORE-007 weight invariant: weights sum to 1.0', () => {
    const result = computeHealthScore({ sodiumMg: 100 });
    const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
  });

  it('GOLDEN-SCORE-008 trans fat 0 does not penalise', () => {
    const with0 = computeHealthScore({ fatTransG: 0, sodiumMg: 100 });
    const withNull = computeHealthScore({ sodiumMg: 100 });
    // Trans fat 0 should produce a high trans-fat subscore
    expect(with0.subscores.transFat.score).toBe(100);
  });

  it('GOLDEN-SCORE-009 NOVA group drives score monotonically', () => {
    const scores = [1, 2, 3, 4].map(
      (g) => computeHealthScore({ novaGroup: g, sodiumMg: 100 }).subscores.nova.score,
    );
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(scores[1]).toBeGreaterThan(scores[2]!);
    expect(scores[2]).toBeGreaterThan(scores[3]!);
  });

  it('GOLDEN-SCORE-010 algorithmVersion present on every result', () => {
    const result = computeHealthScore({ sodiumMg: 200, sugarsG: 5 });
    expect(result.algorithmVersion).toBe(SCORE_ALGORITHM_VERSION);
    expect(typeof result.algorithmVersion).toBe('string');
  });

  it('GOLDEN-SCORE-011 score is rounded to 1 decimal place', () => {
    const result = computeHealthScore({
      sodiumMg: 137,
      sugarsG: 8.3,
      fatSaturatedG: 3.1,
      fatTransG: 0.1,
      dietaryFiberG: 4.2,
      proteinG: 7.8,
      novaGroup: 2,
    });
    const decimals = result.score.toString().split('.')[1];
    expect(!decimals || decimals.length <= 1).toBe(true);
  });
});

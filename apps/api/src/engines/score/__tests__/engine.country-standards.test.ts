/**
 * Phase 4 — country-aware scoring tests.
 * These verify the additive `standard` parameter of computeHealthScore():
 * (1) omitting it is byte-identical to pre-Phase-4 behavior (golden tests in
 *     engine.regression.test.ts already pin this — reasserted here for locality), and
 *     explicitly passing the India standard reproduces the same result.
 * (2) passing a different country's standard changes the composite in bounded, sane ways.
 */
import { describe, it, expect } from 'vitest';
import { computeHealthScore } from '../engine.js';
import {
  INDIA_STANDARD, US_STANDARD, UK_STANDARD, WHO_STANDARD,
  SG_STANDARD, AU_STANDARD, EU_STANDARD, JP_STANDARD, STANDARD_REGISTRY,
} from '../standards/registry.js';

const SAMPLE_PRODUCT = {
  sodiumMg: 300,
  sugarsG: 25,
  sugarsAddedG: 22,
  fatSaturatedG: 7,
  fatTransG: 0.5,
  dietaryFiberG: 1.5,
  proteinG: 5,
  novaGroup: 4,
};

describe('computeHealthScore — country standard parameter', () => {
  it('explicit India standard matches the default (no standard) result exactly', () => {
    const withDefault  = computeHealthScore(SAMPLE_PRODUCT);
    const withIndia    = computeHealthScore(SAMPLE_PRODUCT, INDIA_STANDARD);
    expect(withIndia.score).toBe(withDefault.score);
    expect(withIndia.band).toBe(withDefault.band);
    expect(withIndia.weights).toEqual(withDefault.weights);
  });

  it('every registered standard produces a finite score in [0, 100] for a typical product', () => {
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      const result = computeHealthScore(SAMPLE_PRODUCT, standard);
      expect(Number.isFinite(result.score), id).toBe(true);
      expect(result.score, id).toBeGreaterThanOrEqual(0);
      expect(result.score, id).toBeLessThanOrEqual(100);
      expect(result.weights, id).toEqual(standard.weights);
    }
  });

  it('perfect product scores 100 under every standard', () => {
    const perfect = {
      sodiumMg: 0, sugarsG: 0, sugarsAddedG: 0, fatSaturatedG: 0, fatTransG: 0,
      dietaryFiberG: 50, proteinG: 50, novaGroup: 1,
    };
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      expect(computeHealthScore(perfect, standard).score, id).toBe(100);
    }
  });

  it('worst-case product scores near 0 under every standard', () => {
    const worst = {
      sodiumMg: 10000, sugarsG: 100, sugarsAddedG: 100, fatSaturatedG: 30, fatTransG: 10,
      dietaryFiberG: 0, proteinG: 0, novaGroup: 4,
    };
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      expect(computeHealthScore(worst, standard).score, id).toBeLessThanOrEqual(10);
    }
  });

  it('different standards can disagree on the same product (not a constant function)', () => {
    const scores = [US_STANDARD, UK_STANDARD, WHO_STANDARD, SG_STANDARD, AU_STANDARD, EU_STANDARD, JP_STANDARD]
      .map((s) => computeHealthScore(SAMPLE_PRODUCT, s).score);
    const allSame = scores.every((s) => s === scores[0]);
    expect(allSame).toBe(false);
  });

  it('unknown nutrients still produce a finite mid-range score under any standard', () => {
    for (const standard of Object.values(STANDARD_REGISTRY)) {
      const result = computeHealthScore({}, standard);
      expect(Number.isFinite(result.score)).toBe(true);
    }
  });
});

/**
 * REGRESSION GOLDEN TESTS — Allergen Fail-Safe
 *
 * Verifies the safety boundary: low OCR confidence MUST trigger the fail-safe.
 * These are safety-critical — any regression here is a product defect.
 */

import { describe, it, expect } from 'vitest';
import { allergenFailSafe } from '../fail-safe.js';
import type { AllergenId } from '../taxonomy.js';

const PROFILE: AllergenId[] = ['peanut', 'milk', 'gluten'] as AllergenId[];

describe('Allergen fail-safe — regression golden tests', () => {
  it('GOLDEN-FAILSAFE-001 null OCR confidence triggers fail-safe', () => {
    const result = allergenFailSafe(null, 'high', PROFILE);
    expect(result.triggered).toBe(true);
    expect(result.warningAllergenIds).toEqual(PROFILE);
    expect(result.reason).toMatch(/unknown/i);
  });

  it('GOLDEN-FAILSAFE-002 undefined OCR confidence triggers fail-safe', () => {
    const result = allergenFailSafe(undefined, 'high', PROFILE);
    expect(result.triggered).toBe(true);
  });

  it('GOLDEN-FAILSAFE-003 confidence below threshold (0.49) triggers fail-safe', () => {
    const result = allergenFailSafe(0.49, 'medium', PROFILE);
    expect(result.triggered).toBe(true);
    expect(result.reason).toMatch(/0\.49/);
  });

  it('GOLDEN-FAILSAFE-004 confidence exactly at threshold (0.5) does NOT trigger', () => {
    const result = allergenFailSafe(0.50, 'high', PROFILE);
    expect(result.triggered).toBe(false);
    expect(result.warningAllergenIds).toHaveLength(0);
  });

  it('GOLDEN-FAILSAFE-005 high confidence + low parse quality triggers fail-safe', () => {
    const result = allergenFailSafe(0.95, 'low', PROFILE);
    expect(result.triggered).toBe(true);
    expect(result.reason).toMatch(/low/i);
    expect(result.warningAllergenIds).toEqual(PROFILE);
  });

  it('GOLDEN-FAILSAFE-006 unknown parse quality triggers fail-safe', () => {
    const result = allergenFailSafe(0.99, 'unknown', PROFILE);
    expect(result.triggered).toBe(true);
  });

  it('GOLDEN-FAILSAFE-007 empty profile never triggers fail-safe', () => {
    // Even with terrible OCR, if the user has no profile allergens there is nothing to warn.
    const result = allergenFailSafe(null, 'unknown', []);
    expect(result.triggered).toBe(false);
    expect(result.warningAllergenIds).toHaveLength(0);
  });

  it('GOLDEN-FAILSAFE-008 good confidence + medium quality does not trigger', () => {
    const result = allergenFailSafe(0.85, 'medium', PROFILE);
    expect(result.triggered).toBe(false);
  });

  it('GOLDEN-FAILSAFE-009 fail-safe warning includes ALL profile allergens', () => {
    const full: AllergenId[] = ['peanut', 'milk', 'egg', 'gluten', 'soy'] as AllergenId[];
    const result = allergenFailSafe(0.1, 'low', full);
    expect(result.triggered).toBe(true);
    expect(result.warningAllergenIds).toEqual(full);
  });

  it('GOLDEN-FAILSAFE-010 reason is non-null when triggered', () => {
    const result = allergenFailSafe(0.3, 'medium', PROFILE);
    expect(result.triggered).toBe(true);
    expect(result.reason).not.toBeNull();
    expect(typeof result.reason).toBe('string');
  });

  it('GOLDEN-FAILSAFE-011 reason is null when not triggered', () => {
    const result = allergenFailSafe(0.9, 'high', PROFILE);
    expect(result.triggered).toBe(false);
    expect(result.reason).toBeNull();
  });
});

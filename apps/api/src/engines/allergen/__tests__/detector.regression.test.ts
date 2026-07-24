/**
 * REGRESSION GOLDEN TESTS — Allergen Detection Engine
 *
 * Pins the exact allergen detection behaviour for known product profiles.
 * Any change in keyword lists or detection logic must pass these tests.
 *
 * Determinism rule: detectAllergens() is a pure function — identical inputs
 * must always produce identical outputs. LLMs never enter this path.
 */

import { describe, it, expect } from 'vitest';
import { detectAllergens } from '../detector.js';
import type { AllergenId } from '../taxonomy.js';

describe('Allergen detector — regression golden tests', () => {
  it('GOLDEN-ALLERGEN-001 declared peanut in ingredient list', () => {
    const result = detectAllergens(
      ['peanut oil', 'sugar', 'salt'],
      '',
      ['peanut' as AllergenId],
    );
    expect(result.hasDeclaredAllergen).toBe(true);
    expect(result.matches[0]?.matchType).toBe('declared');
    expect(result.matches[0]?.unsuppressible).toBe(true);
    expect(result.matches[0]?.allergenId).toBe('peanut');
  });

  it('GOLDEN-ALLERGEN-002 trace peanut in raw label text', () => {
    // Use a keyword that exactly matches the traceKeywords list (substring check)
    const result = detectAllergens(
      ['wheat flour', 'sugar', 'cocoa'],
      'warning: may contain peanut and tree nuts',
      ['peanut' as AllergenId],
    );
    expect(result.hasTraceAllergen).toBe(true);
    expect(result.matches[0]?.matchType).toBe('trace');
    expect(result.matches[0]?.unsuppressible).toBe(true);
  });

  it('GOLDEN-ALLERGEN-003 possible cross-contamination language triggers possible warning', () => {
    const result = detectAllergens(
      ['rice', 'salt'],
      'manufactured in a facility that also processes wheat',
      ['gluten' as AllergenId],
    );
    expect(result.hasPossibleAllergen).toBe(true);
    expect(result.matches.every((m) => m.matchType === 'possible')).toBe(true);
    expect(result.matches.every((m) => m.unsuppressible === false)).toBe(true);
  });

  it('GOLDEN-ALLERGEN-004 declared takes priority over possible for same allergen', () => {
    const result = detectAllergens(
      ['wheat flour', 'gluten'],
      'manufactured in a facility that also processes wheat',
      ['gluten' as AllergenId],
    );
    const types = result.matches.map((m) => m.matchType);
    // Should have declared (from ingredients) not just possible
    expect(types).toContain('declared');
    expect(result.hasDeclaredAllergen).toBe(true);
  });

  it('GOLDEN-ALLERGEN-005 no allergens — empty profile', () => {
    const result = detectAllergens(
      ['milk', 'peanut', 'gluten'],
      'contains milk, peanut, wheat',
      [],  // empty profile → all allergens checked
    );
    // With empty profile, all allergens in taxonomy are checked
    expect(result.hasAnyAllergen).toBe(true);
    expect(result.hasDeclaredAllergen).toBe(true);
  });

  it('GOLDEN-ALLERGEN-006 profile filter restricts detection scope', () => {
    const result = detectAllergens(
      ['milk', 'peanut oil'],
      '',
      ['milk' as AllergenId],  // only checking milk
    );
    const ids = result.matches.map((m) => m.allergenId);
    expect(ids).toContain('milk');
    expect(ids).not.toContain('peanut');  // not in profile
  });

  it('GOLDEN-ALLERGEN-007 clean product produces no matches', () => {
    const result = detectAllergens(
      ['rice', 'water', 'salt', 'turmeric'],
      'ingredients: rice, water, salt, turmeric. no artificial preservatives.',
      ['gluten', 'peanut', 'milk'] as AllergenId[],
    );
    expect(result.hasAnyAllergen).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('GOLDEN-ALLERGEN-008 milk aliased form (skimmed milk) detected', () => {
    const result = detectAllergens(
      ['skimmed milk', 'sugar', 'cocoa'],
      '',
      ['milk' as AllergenId],
    );
    expect(result.hasDeclaredAllergen).toBe(true);
  });

  it('GOLDEN-ALLERGEN-009 result shape is stable (all boolean fields present)', () => {
    const result = detectAllergens(['water'], '', []);
    expect(typeof result.hasAnyAllergen).toBe('boolean');
    expect(typeof result.hasDeclaredAllergen).toBe('boolean');
    expect(typeof result.hasTraceAllergen).toBe('boolean');
    expect(typeof result.hasPossibleAllergen).toBe('boolean');
    expect(Array.isArray(result.matches)).toBe(true);
  });

  // Found via live verification against a real product (Nutella) during the premium redesign's
  // Phase 3 wiring — "Gluten free" text on a genuinely gluten-free product was substring-matching
  // the bare "gluten" keyword and producing a false, unsuppressible "Contains Gluten" warning.
  it('GOLDEN-ALLERGEN-010 "gluten free" declaration does not produce a false declared-gluten match', () => {
    const result = detectAllergens(
      ['sugar', 'palm oil', 'hazelnuts', 'skimmed milk powder', 'cocoa', 'lecithin', 'vanillin', 'gluten free'],
      '',
      ['gluten' as AllergenId],
    );
    expect(result.hasDeclaredAllergen).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('GOLDEN-ALLERGEN-011 "gluten-free" (hyphenated) also does not false-positive', () => {
    // Deliberately no other gluten-family keyword ("oat", "wheat", etc.) in the ingredient text —
    // this isolates the hyphenated-negation guard from the (separate, correct) fact that "oat" is
    // itself its own declared keyword in the gluten taxonomy entry, independent of any "gluten"
    // mention.
    const result = detectAllergens(['rice', 'sugar', 'gluten-free certified'], '', ['gluten' as AllergenId]);
    expect(result.hasDeclaredAllergen).toBe(false);
  });

  it('GOLDEN-ALLERGEN-012 a genuine gluten ingredient still matches even when "gluten free" also appears elsewhere', () => {
    const result = detectAllergens(
      ['wheat flour', 'this facility also makes gluten free products'],
      '',
      ['gluten' as AllergenId],
    );
    expect(result.hasDeclaredAllergen).toBe(true);
  });

  it('GOLDEN-ALLERGEN-013 the negation guard applies generically, not just to gluten (e.g. "milk free")', () => {
    const result = detectAllergens(['rice', 'sugar', 'milk free chocolate'], '', ['milk' as AllergenId]);
    expect(result.hasDeclaredAllergen).toBe(false);
  });

  it('GOLDEN-ALLERGEN-014 sanity: a genuine milk ingredient ("rice milk") still matches normally', () => {
    const result = detectAllergens(['rice milk', 'sugar'], '', ['milk' as AllergenId]);
    expect(result.hasDeclaredAllergen).toBe(true);
  });
});

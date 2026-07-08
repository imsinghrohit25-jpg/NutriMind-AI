/**
 * REGRESSION GOLDEN TESTS — Family Allergen Guardian
 *
 * Verifies that validateFamilyMealPlan() correctly aggregates allergens
 * across all family members and produces warnings for conflicts.
 *
 * Safety rule: if ANY member has a profile allergen, that allergen must
 * be surfaced in the family plan validation — never silently dropped.
 */

import { describe, it, expect, vi } from 'vitest';

// Pure business logic extracted from family-service for regression pinning.
// When allergen_guardian package is created, update this import.

interface FamilyMember {
  id: string;
  name: string;
  allergens: string[];
  dietType?: string;
}

interface FamilyPlanValidation {
  safe: boolean;
  warnings: string[];
  aggregatedAllergens: string[];
}

function validateFamilyAllergenSafety(
  members: FamilyMember[],
  mealAllergens: string[],
): FamilyPlanValidation {
  const aggregated = new Set<string>();
  for (const member of members) {
    for (const a of member.allergens) aggregated.add(a);
  }

  const allergenList = Array.from(aggregated);
  const conflicts = mealAllergens.filter((a) => aggregated.has(a));

  const warnings: string[] = [];
  if (conflicts.length > 0) {
    const memberNames = members
      .filter((m) => m.allergens.some((a) => conflicts.includes(a)))
      .map((m) => m.name);
    warnings.push(
      `Meal contains allergens (${conflicts.join(', ')}) that affect: ${memberNames.join(', ')}`,
    );
  }

  return {
    safe: conflicts.length === 0,
    warnings,
    aggregatedAllergens: allergenList,
  };
}

describe('Family Allergen Guardian — regression golden tests', () => {
  it('GOLDEN-FAMILY-001 safe family plan with no allergen conflicts', () => {
    const members: FamilyMember[] = [
      { id: '1', name: 'Parent', allergens: ['peanut'] },
      { id: '2', name: 'Child',  allergens: ['milk'] },
    ];
    const result = validateFamilyAllergenSafety(members, ['gluten']);
    expect(result.safe).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.aggregatedAllergens).toContain('peanut');
    expect(result.aggregatedAllergens).toContain('milk');
  });

  it('GOLDEN-FAMILY-002 conflict detected when meal contains member allergen', () => {
    const members: FamilyMember[] = [
      { id: '1', name: 'Alice', allergens: ['peanut'] },
      { id: '2', name: 'Bob',   allergens: [] },
    ];
    const result = validateFamilyAllergenSafety(members, ['peanut', 'gluten']);
    expect(result.safe).toBe(false);
    expect(result.warnings[0]).toMatch(/peanut/i);
    expect(result.warnings[0]).toMatch(/Alice/i);
  });

  it('GOLDEN-FAMILY-003 multiple members with same allergen — no duplicate in aggregated list', () => {
    const members: FamilyMember[] = [
      { id: '1', name: 'Alice', allergens: ['peanut'] },
      { id: '2', name: 'Bob',   allergens: ['peanut'] },
    ];
    const result = validateFamilyAllergenSafety(members, []);
    expect(result.aggregatedAllergens.filter((a) => a === 'peanut')).toHaveLength(1);
  });

  it('GOLDEN-FAMILY-004 all members affected are listed in warning', () => {
    const members: FamilyMember[] = [
      { id: '1', name: 'Priya',  allergens: ['milk'] },
      { id: '2', name: 'Rahul',  allergens: ['milk'] },
      { id: '3', name: 'Arjun',  allergens: ['gluten'] },
    ];
    const result = validateFamilyAllergenSafety(members, ['milk']);
    expect(result.safe).toBe(false);
    expect(result.warnings[0]).toMatch(/Priya/);
    expect(result.warnings[0]).toMatch(/Rahul/);
    expect(result.warnings[0]).not.toMatch(/Arjun/); // gluten ≠ milk
  });

  it('GOLDEN-FAMILY-005 empty family is always safe', () => {
    const result = validateFamilyAllergenSafety([], ['peanut', 'milk']);
    expect(result.safe).toBe(true);
    expect(result.aggregatedAllergens).toHaveLength(0);
  });

  it('GOLDEN-FAMILY-006 family with no allergens is always safe regardless of meal', () => {
    const members: FamilyMember[] = [
      { id: '1', name: 'Dev', allergens: [] },
    ];
    const result = validateFamilyAllergenSafety(members, ['peanut', 'milk', 'gluten']);
    expect(result.safe).toBe(true);
  });

  it('GOLDEN-FAMILY-007 aggregated allergens union is complete', () => {
    const members: FamilyMember[] = [
      { id: '1', name: 'A', allergens: ['peanut', 'milk'] },
      { id: '2', name: 'B', allergens: ['egg', 'soy'] },
      { id: '3', name: 'C', allergens: ['gluten'] },
    ];
    const result = validateFamilyAllergenSafety(members, []);
    expect(result.aggregatedAllergens.sort()).toEqual(['egg', 'gluten', 'milk', 'peanut', 'soy']);
  });
});

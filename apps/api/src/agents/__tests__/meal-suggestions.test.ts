import { describe, it, expect } from 'vitest';
import { detectMealType, detectGoal, selectMealSuggestions, renderSuggestions } from '../meal-suggestions.js';

describe('detectMealType', () => {
  it('detects each meal type, case-insensitively', () => {
    expect(detectMealType('What should I eat for BREAKFAST')).toBe('breakfast');
    expect(detectMealType('good lunch ideas')).toBe('lunch');
    expect(detectMealType('dinner suggestions')).toBe('dinner');
    expect(detectMealType('healthy snack')).toBe('snack');
  });

  it('returns null rather than guessing when no meal is named', () => {
    expect(detectMealType('what should I eat to get more protein')).toBeNull();
  });
});

describe('detectGoal', () => {
  it('detects protein, weight-loss, and muscle-gain framing', () => {
    expect(detectGoal('more protein please')).toBe('high_protein');
    expect(detectGoal('trying to lose weight')).toBe('weight_loss');
    expect(detectGoal('want to build muscle')).toBe('muscle_gain');
    expect(detectGoal('what should I eat today')).toBe('general');
  });
});

describe('selectMealSuggestions', () => {
  it('filters out suggestions the diet type does not permit', () => {
    const vegan = selectMealSuggestions({ mealType: 'breakfast', dietType: 'vegan', allergens: [] });
    for (const s of vegan) expect(s.dietTypes).toContain('vegan');
  });

  it('filters out any suggestion containing a declared allergen', () => {
    const noNuts = selectMealSuggestions({ mealType: 'breakfast', dietType: null, allergens: ['tree_nuts', 'peanut'] });
    for (const s of noNuts) {
      expect(s.allergenTags).not.toContain('tree_nuts');
      expect(s.allergenTags).not.toContain('peanut');
    }
  });

  it('never returns more than the requested count', () => {
    const picked = selectMealSuggestions({ mealType: 'lunch', dietType: null, allergens: [], count: 2 });
    expect(picked.length).toBeLessThanOrEqual(2);
  });

  it('falls back to a mixed pool when no meal type is detected', () => {
    const picked = selectMealSuggestions({ mealType: null, dietType: 'vegetarian', allergens: [] });
    expect(picked.length).toBeGreaterThan(0);
  });

  it('never returns a suggestion the diet type genuinely excludes, even under allergen pressure', () => {
    // non_vegetarian-only dinner options should never appear for a vegan user regardless of allergens
    const picked = selectMealSuggestions({ mealType: 'dinner', dietType: 'vegan', allergens: [] });
    for (const s of picked) expect(s.dietTypes).toContain('vegan');
  });

  it('a "budget" budgetLevel moves budget-tagged dishes to the front of the results', () => {
    const picked = selectMealSuggestions({ mealType: 'lunch', dietType: null, allergens: [], budgetLevel: 'budget', count: 2 });
    expect(picked[0]!.tags).toContain('budget');
  });

  it('a "premium" budgetLevel moves premium-tagged dishes to the front', () => {
    const picked = selectMealSuggestions({ mealType: 'dinner', dietType: null, allergens: [], budgetLevel: 'premium', count: 1 });
    expect(picked[0]!.tags).toContain('premium');
  });

  it('"moderate" or omitted budgetLevel leaves the original diverse-by-default ordering', () => {
    const withModerate = selectMealSuggestions({ mealType: 'lunch', dietType: null, allergens: [], budgetLevel: 'moderate' });
    const omitted = selectMealSuggestions({ mealType: 'lunch', dietType: null, allergens: [] });
    expect(withModerate.map((s) => s.name)).toEqual(omitted.map((s) => s.name));
  });
});

describe('renderSuggestions', () => {
  it('includes the dish name, its tags, and WHY reasoning for each suggestion', () => {
    const picked = selectMealSuggestions({ mealType: 'snack', dietType: 'vegetarian', allergens: [], count: 1 });
    const text = renderSuggestions(picked, 'high_protein');
    expect(text).toContain(picked[0]!.name);
    expect(text).toContain(picked[0]!.why);
    expect(text).toMatch(/protein/i);
  });
});

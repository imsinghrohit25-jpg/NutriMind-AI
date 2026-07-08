import { describe, it, expect } from 'vitest';
import { scoreMenuItemForUser, estimateMenuItemNutrition } from '../menu-scanner.js';
import type { MenuItem } from '../menu-scanner.js';

const VEG_ITEM: MenuItem = {
  name: 'Dal Makhani',
  isVeg: true,
  category: 'main',
  ingredients: ['black lentils', 'butter', 'cream'],
};

const NON_VEG_ITEM: MenuItem = {
  name: 'Chicken Tikka',
  isVeg: false,
  category: 'starter',
  ingredients: ['chicken', 'yogurt', 'spices'],
};

const DESSERT_ITEM: MenuItem = {
  name: 'Gulab Jamun',
  isVeg: true,
  category: 'dessert',
  ingredients: ['khoya', 'sugar', 'cardamom'],
};

const NUT_ITEM: MenuItem = {
  name: 'Kaju Barfi',
  isVeg: true,
  category: 'dessert',
  ingredients: ['cashews', 'sugar', 'ghee'],
};

describe('scoreMenuItemForUser', () => {
  it('marks veg item as good for veg user', () => {
    const r = scoreMenuItemForUser({
      item: VEG_ITEM, userSodiumGoal: 2000, isVeg: true, allergens: [],
    });
    expect(r.suitable).toBe(true);
    expect(r.score).toBe('good');
    expect(r.warnings).toHaveLength(0);
  });

  it('marks non-veg item as avoid for veg user', () => {
    const r = scoreMenuItemForUser({
      item: NON_VEG_ITEM, userSodiumGoal: 2000, isVeg: true, allergens: [],
    });
    expect(r.suitable).toBe(false);
    expect(r.score).toBe('avoid');
    expect(r.warnings[0]).toMatch(/non-vegetarian/i);
  });

  it('allows non-veg item for non-veg user', () => {
    const r = scoreMenuItemForUser({
      item: NON_VEG_ITEM, userSodiumGoal: 2000, isVeg: false, allergens: [],
    });
    expect(r.suitable).toBe(true);
    expect(r.score).toBe('good');
  });

  it('marks dessert as neutral with warning', () => {
    const r = scoreMenuItemForUser({
      item: DESSERT_ITEM, userSodiumGoal: 2000, isVeg: true, allergens: [],
    });
    expect(r.suitable).toBe(true);
    expect(r.score).toBe('neutral');
    expect(r.warnings.some((w) => /sugar/i.test(w))).toBe(true);
  });

  it('avoids nut item for user with nut allergen', () => {
    const r = scoreMenuItemForUser({
      item: NUT_ITEM, userSodiumGoal: 2000, isVeg: true, allergens: ['cashews'],
    });
    expect(r.suitable).toBe(false);
    expect(r.score).toBe('avoid');
    expect(r.warnings.some((w) => /cashews/i.test(w))).toBe(true);
  });

  it('does not flag item when no allergens declared', () => {
    const r = scoreMenuItemForUser({
      item: NUT_ITEM, userSodiumGoal: 2000, isVeg: true, allergens: [],
    });
    expect(r.suitable).toBe(true);
  });
});

describe('estimateMenuItemNutrition — Phase 5', () => {
  it('always returns isEstimated: true and a low confidence', () => {
    const r = estimateMenuItemNutrition(VEG_ITEM);
    expect(r.isEstimated).toBe(true);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(0.5);
  });

  it('uses ingredient_density basis when ingredients are present', () => {
    const r = estimateMenuItemNutrition(VEG_ITEM);
    expect(r.basis).toBe('ingredient_density');
    expect(r.nutrients.calories).toBeGreaterThan(0);
  });

  it('falls back to no_ingredients_unknown basis with lower confidence when ingredients are absent', () => {
    const noIngredients: MenuItem = { name: 'Chef Special', isVeg: true };
    const withIngredients = estimateMenuItemNutrition(VEG_ITEM);
    const without = estimateMenuItemNutrition(noIngredients);
    expect(without.basis).toBe('no_ingredients_unknown');
    expect(without.confidence).toBeLessThan(withIngredients.confidence);
    expect(Number.isFinite(without.nutrients.calories)).toBe(true);
  });

  it('is deterministic for the same menu item', () => {
    const a = estimateMenuItemNutrition(VEG_ITEM);
    const b = estimateMenuItemNutrition(VEG_ITEM);
    expect(a).toEqual(b);
  });

  it('never throws regardless of category', () => {
    for (const category of ['starter', 'main', 'dessert', 'drink', 'bread', 'rice', 'biryani', 'snack', undefined]) {
      const item: MenuItem = { name: 'Test Item', isVeg: true, category, ingredients: ['rice'] };
      expect(() => estimateMenuItemNutrition(item)).not.toThrow();
    }
  });
});

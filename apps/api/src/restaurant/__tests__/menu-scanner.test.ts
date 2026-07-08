import { describe, it, expect } from 'vitest';
import { scoreMenuItemForUser } from '../menu-scanner.js';
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

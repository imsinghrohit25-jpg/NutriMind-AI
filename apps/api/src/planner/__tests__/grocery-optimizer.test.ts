import { describe, it, expect } from 'vitest';
import { buildGroceryList } from '../grocery-optimizer.js';
import { US_GROCERY_PROVIDER, UK_GROCERY_PROVIDER, INDIA_GROCERY_PROVIDER } from '../grocery-providers/registry.js';
import type { GeneratedRecipe } from '../../restaurant/recipe-generator.js';

function makeRecipe(ingredients: Array<{ name: string; totalGrams: number }>): GeneratedRecipe {
  return {
    name: 'Test Recipe', servings: 2, cuisine: 'generic', dietType: 'vegetarian',
    prepTimeMin: 10, cookTimeMin: 20,
    ingredients: ingredients.map((i) => ({
      name: i.name, quantity: i.totalGrams, unit: 'g', gramsPerUnit: 1, totalGrams: i.totalGrams,
    })),
    steps: [],
    totalNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 0 },
    perServingNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 0 },
    allergens: [], tags: [],
  };
}

describe('buildGroceryList — Phase 5 country-aware pricing', () => {
  const recipe = makeRecipe([{ name: 'rice', totalGrams: 500 }, { name: 'chicken', totalGrams: 300 }]);

  it('defaults to the India provider when no provider is passed (pre-Phase-5 behavior)', () => {
    const items = buildGroceryList([recipe]);
    expect(items.every((i) => i.currencyCode === 'INR')).toBe(true);
    const rice = items.find((i) => i.name === 'rice')!;
    expect(rice.estimatedPrice).toBe(30); // 0.5kg * ₹60/kg, whole-rupee rounding
  });

  it('explicit India provider matches the default result exactly', () => {
    const withDefault = buildGroceryList([recipe]);
    const withIndia    = buildGroceryList([recipe], INDIA_GROCERY_PROVIDER);
    expect(withIndia).toEqual(withDefault);
  });

  it('US provider prices in USD with 2-decimal rounding', () => {
    const items = buildGroceryList([recipe], US_GROCERY_PROVIDER);
    expect(items.every((i) => i.currencyCode === 'USD')).toBe(true);
    const rice = items.find((i) => i.name === 'rice')!;
    expect(rice.estimatedPrice).toBe(1.1); // 0.5kg * $2.20/kg
  });

  it('UK provider prices in GBP', () => {
    const items = buildGroceryList([recipe], UK_GROCERY_PROVIDER);
    expect(items.every((i) => i.currencyCode === 'GBP')).toBe(true);
  });

  it('different providers can price the same recipe differently', () => {
    const inTotal = buildGroceryList([recipe], INDIA_GROCERY_PROVIDER)
      .reduce((s, i) => s + (i.estimatedPrice ?? 0), 0);
    const usTotal = buildGroceryList([recipe], US_GROCERY_PROVIDER)
      .reduce((s, i) => s + (i.estimatedPrice ?? 0), 0);
    expect(inTotal).not.toBe(usTotal);
  });

  it('categorises and sorts items using the provider category order', () => {
    const items = buildGroceryList([recipe]);
    const categories = items.map((i) => i.category);
    const sorted = [...categories].sort(
      (a, b) => INDIA_GROCERY_PROVIDER.categoryOrder.indexOf(a) - INDIA_GROCERY_PROVIDER.categoryOrder.indexOf(b),
    );
    expect(categories).toEqual(sorted);
  });

  it('unmatched ingredient falls back to the provider default price', () => {
    const mystery = makeRecipe([{ name: 'dragonfruit-essence', totalGrams: 1000 }]);
    const items = buildGroceryList([mystery], INDIA_GROCERY_PROVIDER);
    expect(items[0]!.estimatedPrice).toBe(INDIA_GROCERY_PROVIDER.defaultPricePerKg);
  });

  it('empty recipe list produces an empty grocery list', () => {
    expect(buildGroceryList([])).toEqual([]);
  });
});

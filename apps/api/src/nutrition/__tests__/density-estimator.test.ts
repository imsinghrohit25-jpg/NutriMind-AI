import { describe, it, expect } from 'vitest';
import { estimateNutrientsByDensity, sumNutrients, divideNutrients } from '../density-estimator.js';

describe('estimateNutrientsByDensity', () => {
  it('matches a known ingredient by substring', () => {
    const result = estimateNutrientsByDensity('basmati rice', 100);
    expect(result.calories).toBe(Math.round(100 * 3.6));
  });

  it('falls back to the generic ~2 kcal/g estimate for unmatched ingredients', () => {
    const result = estimateNutrientsByDensity('dragonfruit-essence', 100);
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(0);
  });

  it('is deterministic — same input always produces the same output', () => {
    const a = estimateNutrientsByDensity('chicken', 250);
    const b = estimateNutrientsByDensity('chicken', 250);
    expect(a).toEqual(b);
  });

  it('scales linearly with grams', () => {
    const single = estimateNutrientsByDensity('dal', 100);
    const doubled = estimateNutrientsByDensity('dal', 200);
    expect(doubled.calories).toBe(single.calories * 2);
  });
});

describe('sumNutrients / divideNutrients', () => {
  it('sums across multiple estimates', () => {
    const a = { calories: 100, protein: 10, carbs: 20, fat: 5, fibre: 2, sodium: 50 };
    const b = { calories: 200, protein: 5,  carbs: 10, fat: 8, fibre: 1, sodium: 30 };
    expect(sumNutrients([a, b])).toEqual({
      calories: 300, protein: 15, carbs: 30, fat: 13, fibre: 3, sodium: 80,
    });
  });

  it('sums an empty array to all zeros', () => {
    expect(sumNutrients([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 0 });
  });

  it('divides evenly across servings', () => {
    const total = { calories: 400, protein: 40, carbs: 80, fat: 20, fibre: 8, sodium: 200 };
    expect(divideNutrients(total, 4)).toEqual({
      calories: 100, protein: 10, carbs: 20, fat: 5, fibre: 2, sodium: 50,
    });
  });

  it('treats 0 or negative servings as 1 (never divides by zero)', () => {
    const total = { calories: 100, protein: 10, carbs: 10, fat: 10, fibre: 10, sodium: 10 };
    expect(divideNutrients(total, 0)).toEqual(total);
    expect(() => divideNutrients(total, -5)).not.toThrow();
  });
});

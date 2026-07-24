import { describe, it, expect } from 'vitest';
import { scaleNutritionToPortion, sumMealNutrition } from '../meal-photo/nutrient-scaling.js';

describe('scaleNutritionToPortion', () => {
  it('scales every nutrient by portionGrams/100 and rounds to 2dp', () => {
    const scaled = scaleNutritionToPortion(
      { energyKcal: 120, proteinG: 9, sodiumMg: 250, vitaminCMg: 3.3 },
      180,
    );
    expect(scaled.portionGrams).toBe(180);
    expect(scaled.energyKcal).toBe(216);
    expect(scaled.proteinG).toBe(16.2);
    expect(scaled.sodiumMg).toBe(450);
    expect(scaled.vitaminCMg).toBe(5.94);
  });

  it('null nutrients stay null (never coerced to 0)', () => {
    const scaled = scaleNutritionToPortion({ energyKcal: 100, proteinG: null }, 150);
    expect(scaled.proteinG).toBeNull();
    expect(scaled.dietaryFiberG).toBeNull(); // absent field
  });
});

describe('sumMealNutrition', () => {
  it('totals scaled panels across dishes; partial coverage sums what exists', () => {
    const dal = scaleNutritionToPortion({ energyKcal: 110, proteinG: 7, sodiumMg: 300, calciumMg: 40 }, 180);
    const rice = scaleNutritionToPortion({ energyKcal: 130, proteinG: 2.7, sodiumMg: 5, calciumMg: null }, 150);
    const totals = sumMealNutrition([dal, rice]);

    expect(totals.dishesIncluded).toBe(2);
    expect(totals.totalPortionGrams).toBe(330);
    expect(totals.energyKcal).toBe(198 + 195);
    expect(totals.proteinG).toBeCloseTo(12.6 + 4.05, 2);
    expect(totals.sodiumMg).toBeCloseTo(540 + 7.5, 2);
    // calcium reported by only one dish → still summed from that dish, not null
    expect(totals.calciumMg).toBe(72);
    // reported by no dish → null, not 0
    expect(totals.vitaminDIu).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeUsdaFood } from '../usda/normalize.js';
import type { UsdaFoodDetail } from '../usda/client.js';

function makeNutrient(id: number, name: string, amount: number, unit: string) {
  return { nutrient: { id, name, unitName: unit }, amount };
}

const SAMPLE_FOOD: UsdaFoodDetail = {
  fdcId: 170379,
  description: 'Dal, red lentils, raw',
  dataType: 'SR Legacy',
  servingSize: 100,
  servingSizeUnit: 'g',
  ingredients: undefined,
  foodNutrients: [
    makeNutrient(1008, 'Energy', 353, 'kcal'),
    makeNutrient(1003, 'Protein', 24.6, 'g'),
    makeNutrient(1004, 'Total lipid (fat)', 1.06, 'g'),
    makeNutrient(1258, 'Fatty acids, total saturated', 0.154, 'g'),
    makeNutrient(1005, 'Carbohydrate, by difference', 63.4, 'g'),
    makeNutrient(2000, 'Sugars, total including NLEA', 2.03, 'g'),
    makeNutrient(1079, 'Fiber, total dietary', 10.8, 'g'),
    makeNutrient(1093, 'Sodium, Na', 6, 'mg'),
    makeNutrient(1087, 'Calcium, Ca', 35, 'mg'),
    makeNutrient(1089, 'Iron, Fe', 7.54, 'mg'),
    makeNutrient(1092, 'Potassium, K', 677, 'mg'),
    makeNutrient(1162, 'Vitamin C', 4.4, 'mg'),
    makeNutrient(1106, 'Vitamin A, RAE', 2, 'mcg'),
    makeNutrient(1114, 'Vitamin D (D2+D3)', 0, 'IU'),
    makeNutrient(1177, 'Folate, total', 479, 'mcg'),
    makeNutrient(1178, 'Vitamin B-12', 0, 'mcg'),
  ],
  foodPortions: [
    { amount: 0.25, modifier: 'cup', gramWeight: 48 },
  ],
};

describe('normalizeUsdaFood', () => {
  it('maps description to name', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).name).toBe('Dal, red lentils, raw');
  });

  it('sets USDA provenance', () => {
    const product = normalizeUsdaFood(SAMPLE_FOOD);
    expect(product.source).toBe('usda_fdc');
    expect(product.sourceId).toBe('170379');
    expect(product.licenseClass).toBe('public_domain');
    expect(product.datasetVersion).toBe('SR Legacy');
  });

  it('maps energy', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.energyKcal).toBe(353);
  });

  it('maps protein', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.proteinG).toBe(24.6);
  });

  it('maps fat', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.fatTotalG).toBe(1.06);
  });

  it('maps fiber', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.dietaryFiberG).toBe(10.8);
  });

  it('maps sodium in mg (already mg from FDC)', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.sodiumMg).toBe(6);
  });

  it('maps iron in mg', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.ironMg).toBe(7.54);
  });

  it('converts vitamin A RAE to IU', () => {
    // 2 mcg RAE × 3.333 ≈ 6.67 IU
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.vitaminAIu).toBeCloseTo(6.67, 1);
  });

  it('maps folate', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.folateMcg).toBe(479);
  });

  it('estimates added sugar from total (ADR-0007)', () => {
    const n = normalizeUsdaFood(SAMPLE_FOOD).nutrition!;
    expect(n.sugarsAddedG).toBe(2.03);
    expect(n.sugarsAddedEstimated).toBe(true);
  });

  it('sets high confidence for reference data', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.confidence).toBe(0.9);
  });

  it('NOVA group is null for FDC data', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.novaGroup).toBeNull();
  });

  it('barcode is null (FDC has no barcodes)', () => {
    expect(normalizeUsdaFood(SAMPLE_FOOD).barcode).toBeNull();
  });

  it('fills energyKj from kcal', () => {
    // 353 kcal × 4.184 ≈ 1476.9 kJ
    expect(normalizeUsdaFood(SAMPLE_FOOD).nutrition!.energyKj).toBeCloseTo(1476.9, 0);
  });
});

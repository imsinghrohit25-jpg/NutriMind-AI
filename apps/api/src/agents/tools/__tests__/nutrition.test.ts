import { describe, it, expect } from 'vitest';
import { nutritionComputeTool } from '../nutrition.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';

function makeProduct(overrides: Partial<CanonicalProduct['nutrition']> = {}): CanonicalProduct {
  return {
    source: 'openfoodfacts', sourceId: 'test', datasetVersion: 'live', retrievedAt: new Date(), licenseClass: 'open',
    barcode: '123', barcodeType: 'ean13', name: 'Test Biscuit', brand: 'TestBrand', category: 'snacks',
    subCategory: null, countryOfOrigin: null, servingSizeG: 30, servingDescription: null, packageSizeG: null,
    fssaiVegMark: 'green', imageUrl: null, thumbnailUrl: null, ingredientsRawText: 'Wheat Flour, Sugar, Palm Oil',
    nutrition: {
      source: 'openfoodfacts', sourceId: 'test', datasetVersion: 'live', retrievedAt: new Date(), licenseClass: 'open',
      energyKcal: 450, energyKj: null, proteinG: 6, fatTotalG: 18, fatSaturatedG: 8, fatTransG: 0,
      fatPolyunsaturatedG: null, fatMonounsaturatedG: null, carbohydratesG: 65, sugarsG: 25, sugarsAddedG: 20,
      sugarsAddedEstimated: false, dietaryFiberG: 2, sodiumMg: 400, cholesterolMg: null, calciumMg: null,
      ironMg: null, potassiumMg: null, zincMg: null, vitaminCMg: null, vitaminAIu: null, vitaminDIu: null,
      vitaminB12Mcg: null, folateMcg: null, novaGroup: 4, confidence: 0.9, notes: null,
      ashG: null, moistureG: null,
      ...overrides,
    },
  };
}

describe('nutritionComputeTool', () => {
  it('computes a real health score via the actual engine (not a fabricated number)', async () => {
    const output = await nutritionComputeTool.execute({ product: makeProduct() }, {} as never);
    expect(output.score).not.toBeNull();
    expect(output.score!.score).toBeGreaterThanOrEqual(0);
    expect(output.score!.score).toBeLessThanOrEqual(100);
    expect(output.score!.band).toBeDefined();
  });

  it('never returns a serving-scaled figure unless servingG was supplied', async () => {
    const output = await nutritionComputeTool.execute({ product: makeProduct() }, {} as never);
    expect(output.perServing).toBeNull();
  });

  it('scales per-100g to a real per-serving figure — not invented, a genuine proportional scale-up', async () => {
    const output = await nutritionComputeTool.execute({ product: makeProduct(), servingG: 30 }, {} as never);
    expect(output.perServing).not.toBeNull();
    // 450 kcal/100g * 0.3 = 135 kcal for a 30g serving
    expect(output.perServing!.energyKcal).toBeCloseTo(135, 0);
    expect(output.perServing!.servingG).toBe(30);
  });

  it('returns null score and grade D when the product has no nutrition data at all', async () => {
    const product = makeProduct();
    product.nutrition = null;
    const output = await nutritionComputeTool.execute({ product }, {} as never);
    expect(output.score).toBeNull();
    expect(output.dataQualityGrade).toBe('D');
  });

  it('a high-confidence product grades A, matching the engine\'s own confidence signal, not a fixed default', async () => {
    const output = await nutritionComputeTool.execute({ product: makeProduct({ confidence: 0.95 }) }, {} as never);
    expect(output.dataQualityGrade).toBe('A');
  });

  it('a low-confidence product grades lower than a high-confidence one with identical macros', async () => {
    const high = await nutritionComputeTool.execute({ product: makeProduct({ confidence: 0.95 }) }, {} as never);
    const low = await nutritionComputeTool.execute({ product: makeProduct({ confidence: 0.4 }) }, {} as never);
    const gradeOrder = { A: 0, B: 1, C: 2, D: 3 };
    expect(gradeOrder[low.dataQualityGrade]).toBeGreaterThan(gradeOrder[high.dataQualityGrade]);
  });
});

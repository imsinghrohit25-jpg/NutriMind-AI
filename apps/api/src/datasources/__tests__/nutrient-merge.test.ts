import { describe, it, expect } from 'vitest';
import { mergeTableValuesIntoNutrition } from '../ifct/nutrient-merge.js';
import type { NutritionPer100g } from '../../nutrition/canonical-model.js';

function baseNutrition(overrides: Partial<NutritionPer100g> = {}): NutritionPer100g {
  return {
    source: 'ifct_2017', sourceId: 'A019', datasetVersion: '2017', retrievedAt: new Date(), licenseClass: 'licensed_restricted',
    energyKcal: 350, energyKj: 1465, proteinG: 10, fatTotalG: 1.5, fatSaturatedG: null, fatTransG: null,
    fatPolyunsaturatedG: null, fatMonounsaturatedG: null, carbohydratesG: 70, sugarsG: null,
    sugarsAddedG: null, sugarsAddedEstimated: false, dietaryFiberG: 2, sodiumMg: null, cholesterolMg: null,
    calciumMg: null, ironMg: null, potassiumMg: null, zincMg: null, vitaminCMg: null, vitaminAIu: null,
    vitaminDIu: null, vitaminB12Mcg: null, folateMcg: null, novaGroup: null, confidence: 0.95, notes: null,
    ashG: 1.2, moistureG: 11.3,
    ...overrides,
  };
}

describe('mergeTableValuesIntoNutrition', () => {
  it('writes a dedicated-column nutrient directly, never through nutrientExtra', () => {
    const merged = mergeTableValuesIntoNutrition(
      baseNutrition(),
      { vitaminCMg: { value: 29.22, sd: 1.92, state: 'measured' } },
      { vitaminCMg: 'vitaminCMg' },
    );
    expect(merged.vitaminCMg).toBe(29.22);
    expect(merged.nutrientExtra?.vitaminCMg).toBeUndefined();
    expect(merged.nutrientSd?.vitaminCMg).toBe(1.92);
    expect(merged.nutrientValueState?.vitaminCMg).toBe('measured');
  });

  it('routes a nutrient with no dedicated column through nutrientExtra', () => {
    const merged = mergeTableValuesIntoNutrition(
      baseNutrition(),
      { biotinMcg: { value: 0.76, sd: 0.12, state: 'measured' } },
      {},
    );
    expect(merged.nutrientExtra).toEqual({ biotinMcg: 0.76 });
    expect(merged.nutrientSd).toEqual({ biotinMcg: 0.12 });
  });

  it('preserves prior tables own sidecar entries instead of clobbering them', () => {
    const existing = baseNutrition({
      nutrientSd: { proteinG: 0.29 },
      nutrientValueState: { proteinG: 'measured' },
      nutrientExtra: { ashG: 1.2 },
    });
    const merged = mergeTableValuesIntoNutrition(
      existing,
      { thiamineMg: { value: 0.42, sd: 0.04, state: 'measured' } },
      {},
    );
    expect(merged.nutrientSd).toEqual({ proteinG: 0.29, thiamineMg: 0.04 });
    expect(merged.nutrientValueState).toEqual({ proteinG: 'measured', thiamineMg: 'measured' });
    expect(merged.nutrientExtra).toEqual({ ashG: 1.2, thiamineMg: 0.42 });
  });

  it('records a not_analyzed state without writing a fabricated numeric value anywhere', () => {
    const merged = mergeTableValuesIntoNutrition(
      baseNutrition(),
      { biotinMcg: { value: null, sd: null, state: 'not_analyzed' } },
      {},
    );
    expect(merged.nutrientValueState?.biotinMcg).toBe('not_analyzed');
    expect(merged.nutrientExtra?.biotinMcg).toBeUndefined();
    expect(merged.nutrientSd?.biotinMcg).toBeUndefined();
  });

  it('omits empty sidecar objects entirely rather than leaving empty-object noise', () => {
    const merged = mergeTableValuesIntoNutrition(baseNutrition(), {}, {});
    expect(merged.nutrientSd).toBeUndefined();
    expect(merged.nutrientValueState).toBeUndefined();
    expect(merged.nutrientExtra).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { rowToNutrition, type NutritionRow } from '../cache.js';

function baseRow(overrides: Partial<NutritionRow> = {}): NutritionRow {
  return {
    energy_kcal: '350.00', energy_kj: '1465.00', protein_g: '10.00', fat_total_g: '1.50',
    fat_saturated_g: null, fat_trans_g: null, fat_polyunsaturated_g: null, fat_monounsaturated_g: null,
    carbohydrates_g: '70.00', sugars_g: null, sugars_added_g: null, sugars_added_estimated: false,
    dietary_fiber_g: '2.00', sodium_mg: null, cholesterol_mg: null,
    calcium_mg: null, iron_mg: null, potassium_mg: null, zinc_mg: null,
    vitamin_c_mg: null, vitamin_a_iu: null, vitamin_d_iu: null, vitamin_b12_mcg: null, folate_mcg: null,
    nova_group: null, confidence: '0.95', notes: null,
    ash_g: '1.20', moisture_g: '11.30', nutrient_sd: null, nutrient_value_state: null, nutrient_extra: null,
    source: 'ifct_2017', source_id: 'A019', dataset_version: '2017', retrieved_at: new Date(), license_class: 'licensed_restricted',
    ...overrides,
  };
}

describe('rowToNutrition', () => {
  it('maps a genuinely-null NUMERIC column to null, not a false zero', () => {
    // Regression test: `pg(Number(row.field))` used to coerce SQL NULL -> 0, because
    // `Number(null) === 0` in JS runs before any null-check. Found while building ADR-0031 Table 2's
    // merge-import, the first real code path to read a row back and persist it again — a
    // vitamin_c_mg the food was never analyzed for (a real NULL) was silently written back as 0.
    const n = rowToNutrition(baseRow({ vitamin_c_mg: null, calcium_mg: null }));
    expect(n.vitaminCMg).toBeNull();
    expect(n.calciumMg).toBeNull();
  });

  it('still maps a real zero measurement to 0, distinct from null', () => {
    const n = rowToNutrition(baseRow({ vitamin_c_mg: '0.00' }));
    expect(n.vitaminCMg).toBe(0);
  });

  it('maps a real positive value correctly', () => {
    const n = rowToNutrition(baseRow({ folate_mcg: '29.22' }));
    expect(n.folateMcg).toBe(29.22);
  });

  it('passes through the nutrient_extra sidecar', () => {
    const n = rowToNutrition(baseRow({ nutrient_extra: { biotinMcg: 0.76 } }));
    expect(n.nutrientExtra).toEqual({ biotinMcg: 0.76 });
  });

  it('leaves nutrient_extra undefined (not null) when the column is null', () => {
    const n = rowToNutrition(baseRow({ nutrient_extra: null }));
    expect(n.nutrientExtra).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { STANDARD_REGISTRY, getNutritionStandard, WHO_STANDARD } from '../registry.js';
import { assertWeightsSum } from '../types.js';
import { COUNTRY_REGISTRY } from '../../../../country/registry.js';

const NEGATIVE_KEYS = ['sodium', 'sugar', 'satFat'] as const;
const POSITIVE_KEYS = ['fibre', 'protein'] as const;

describe('Country Nutrition Standard registry', () => {
  it('every registered standard has weights summing to 1.0', () => {
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      expect(() => assertWeightsSum(standard.weights, id)).not.toThrow();
    }
  });

  it('every registered standard has monotonically increasing negative-nutrient thresholds', () => {
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      for (const key of NEGATIVE_KEYS) {
        const t = standard.thresholds[key];
        expect(t.veryLow, `${id}.${key}.veryLow`).toBeLessThan(t.low);
        expect(t.low, `${id}.${key}.low`).toBeLessThan(t.moderate);
        expect(t.moderate, `${id}.${key}.moderate`).toBeLessThan(t.high);
        expect(t.high, `${id}.${key}.high`).toBeLessThan(t.veryHigh);
      }
    }
  });

  it('every registered standard has monotonically increasing positive-nutrient thresholds', () => {
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      for (const key of POSITIVE_KEYS) {
        const t = standard.thresholds[key];
        expect(t.veryLow, `${id}.${key}.veryLow`).toBeLessThanOrEqual(t.low);
        expect(t.low, `${id}.${key}.low`).toBeLessThan(t.moderate);
        expect(t.moderate, `${id}.${key}.moderate`).toBeLessThan(t.high);
        expect(t.high, `${id}.${key}.high`).toBeLessThan(t.veryHigh);
      }
    }
  });

  it('every registered standard has monotonically increasing trans-fat thresholds', () => {
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      const t = standard.thresholds.transFat;
      expect(t.none, `${id}.transFat.none`).toBeLessThan(t.trace);
      expect(t.trace, `${id}.transFat.trace`).toBeLessThan(t.low);
      expect(t.low, `${id}.transFat.low`).toBeLessThan(t.high);
    }
  });

  it('covers every NutritionStandard id referenced by the live country registry', () => {
    const referencedIds = new Set(
      [...COUNTRY_REGISTRY.values()].map((profile) => profile.nutritionStandard),
    );
    for (const id of referencedIds) {
      expect(STANDARD_REGISTRY[id], `missing standard for ${id}`).toBeDefined();
    }
  });

  it('getNutritionStandard falls back to WHO for unknown ids', () => {
    expect(getNutritionStandard('NOT_A_REAL_STANDARD')).toBe(WHO_STANDARD);
    expect(getNutritionStandard(undefined)).toBe(WHO_STANDARD);
    expect(getNutritionStandard(null)).toBe(WHO_STANDARD);
  });

  it('getNutritionStandard resolves ICMR_NIN to the India pack', () => {
    const standard = getNutritionStandard('ICMR_NIN');
    expect(standard.isoCountryCodes).toContain('IN');
  });

  it('each standard declares at least one ISO country code (or GLOBAL for the WHO fallback)', () => {
    for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
      expect(standard.isoCountryCodes.length, id).toBeGreaterThan(0);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  kjToKcal, kcalToKj, gToMg, mgToG,
  vitaminARaeToIu, vitaminDMcgToIu,
  perServingToPer100g, parseServingSizeG, parsePackageSizeG, detectBarcodeType,
} from '../units.js';
import {
  estimateEnergyKcal, estimateAddedSugar, energyConsistencyNote,
} from '../derived.js';

describe('Unit conversions', () => {
  it('converts kJ to kcal', () => {
    expect(kjToKcal(418.4)).toBeCloseTo(100, 1);
  });

  it('converts kcal to kJ', () => {
    expect(kcalToKj(100)).toBeCloseTo(418.4, 1);
  });

  it('converts g to mg', () => {
    expect(gToMg(1.5)).toBe(1500);
  });

  it('converts mg to g', () => {
    expect(mgToG(500)).toBe(0.5);
  });

  it('converts vitamin A RAE to IU', () => {
    expect(vitaminARaeToIu(300)).toBeCloseTo(999.9, 0);
  });

  it('converts vitamin D mcg to IU', () => {
    expect(vitaminDMcgToIu(10)).toBe(400);
  });

  it('scales per-serving to per-100g', () => {
    expect(perServingToPer100g(6, 30)).toBeCloseTo(20, 5);
  });

  it('returns value unchanged when servingSize is 0', () => {
    expect(perServingToPer100g(6, 0)).toBe(6);
  });
});

describe('parseServingSizeG', () => {
  it('parses plain grams', () => expect(parseServingSizeG('30g')).toBe(30));
  it('parses with space', () => expect(parseServingSizeG('100 g')).toBe(100));
  it('parses ml as grams', () => expect(parseServingSizeG('240ml')).toBe(240));
  it('parses kg', () => expect(parseServingSizeG('1kg')).toBe(1000));
  it('parses plain number', () => expect(parseServingSizeG('50')).toBe(50));
  it('handles cups with embedded grams', () => expect(parseServingSizeG('1 cup (240ml)')).toBe(240));
  it('returns null for null input', () => expect(parseServingSizeG(null)).toBeNull());
  it('returns null for empty string', () => expect(parseServingSizeG('')).toBeNull());
});

describe('parsePackageSizeG', () => {
  it('parses grams', () => expect(parsePackageSizeG('200g')).toBe(200));
  it('parses kg', () => expect(parsePackageSizeG('1.5 kg')).toBe(1500));
  it('parses liters', () => expect(parsePackageSizeG('1L')).toBe(1000));
  it('returns null for unrecognised', () => expect(parsePackageSizeG('1 dozen')).toBeNull());
});

describe('detectBarcodeType', () => {
  it('detects EAN-13', () => expect(detectBarcodeType('8901234567890')).toBe('ean13'));
  it('detects EAN-8', () => expect(detectBarcodeType('12345678')).toBe('ean8'));
  it('detects UPC-A', () => expect(detectBarcodeType('012345678905')).toBe('upc_a'));
  it('falls back to other', () => expect(detectBarcodeType('12345')).toBe('other'));
});

describe('estimateEnergyKcal (Atwater)', () => {
  it('calculates from macros', () => {
    // 10g protein + 5g fat + 20g carbs = 40 + 45 + 80 = 165 kcal
    expect(estimateEnergyKcal(10, 5, 20)).toBe(165);
  });

  it('returns null when all macros null', () => {
    expect(estimateEnergyKcal(null, null, null)).toBeNull();
  });

  it('uses 0 for null macros when at least one non-null', () => {
    expect(estimateEnergyKcal(10, null, null)).toBe(40);
  });
});

describe('estimateAddedSugar (ADR-0007)', () => {
  it('uses direct value when available, not estimated', () => {
    const result = estimateAddedSugar(5, 12);
    expect(result.sugarsAddedG).toBe(5);
    expect(result.sugarsAddedEstimated).toBe(false);
  });

  it('uses total sugars as upper bound when direct unavailable, marks estimated', () => {
    const result = estimateAddedSugar(undefined, 12);
    expect(result.sugarsAddedG).toBe(12);
    expect(result.sugarsAddedEstimated).toBe(true);
  });

  it('returns null/false when no sugar data', () => {
    const result = estimateAddedSugar(undefined, null);
    expect(result.sugarsAddedG).toBeNull();
    expect(result.sugarsAddedEstimated).toBe(false);
  });

  it('treats null direct value as missing', () => {
    const result = estimateAddedSugar(null, 8);
    expect(result.sugarsAddedG).toBe(8);
    expect(result.sugarsAddedEstimated).toBe(true);
  });
});

describe('energyConsistencyNote', () => {
  it('returns null when energy is consistent', () => {
    // 10g protein + 5g fat + 20g carbs = 165 kcal
    expect(energyConsistencyNote(165, 10, 5, 20)).toBeNull();
  });

  it('returns note when deviation > 10%', () => {
    // 10g protein + 5g fat + 20g carbs = 165 kcal; report 300 = 81% deviation
    const note = energyConsistencyNote(300, 10, 5, 20);
    expect(note).not.toBeNull();
    expect(note).toContain('kcal');
  });

  it('returns null when reported energy is null', () => {
    expect(energyConsistencyNote(null, 10, 5, 20)).toBeNull();
  });
});

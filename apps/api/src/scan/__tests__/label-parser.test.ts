import { describe, it, expect } from 'vitest';
import { parseLabelText } from '../label-parser/parser.js';

// Real FSSAI-format label text samples (synthetic but representative)
const MAGGI_LIKE_LABEL = `
Nutritional Information (Approximate values per 100g)
Energy 390 kcal
Protein 10.5 g
Carbohydrate 66.0 g
  of which Sugars 3.2 g
Total Fat 9.5 g
  Saturated Fatty Acids 4.5 g
  Trans Fatty Acids 0.0 g
Dietary Fibre 2.0 g
Sodium 1100 mg
`;

const BISCUIT_PER_SERVING_LABEL = `
Nutrition Facts per serving (25 g)
Calories 120 kcal
Total Fat 4.5 g
  Saturated Fat 2.0 g
  Trans Fat 0 g
Total Carbohydrate 18 g
  Total Sugars 5 g
Protein 2 g
Sodium 95 mg
`;

const LOW_QUALITY_OCR = `
Nutritlon lnformation
Energy 395 Kca
Protem 11 g
Carbs 6S g
Fat 10g
`;

describe('parseLabelText', () => {
  describe('per-100g FSSAI label', () => {
    const result = parseLabelText(MAGGI_LIKE_LABEL);

    it('extracts energy', () => {
      expect(result.nutrition.energyKcal).toBe(390);
    });

    it('extracts protein', () => {
      expect(result.nutrition.proteinG).toBeCloseTo(10.5);
    });

    it('extracts carbohydrates', () => {
      expect(result.nutrition.carbohydratesG).toBeCloseTo(66.0);
    });

    it('extracts total fat', () => {
      expect(result.nutrition.fatTotalG).toBeCloseTo(9.5);
    });

    it('extracts saturated fat', () => {
      expect(result.nutrition.fatSaturatedG).toBeCloseTo(4.5);
    });

    it('extracts trans fat', () => {
      expect(result.nutrition.fatTransG).toBeCloseTo(0.0);
    });

    it('extracts fibre', () => {
      expect(result.nutrition.dietaryFiberG).toBeCloseTo(2.0);
    });

    it('extracts sodium', () => {
      expect(result.nutrition.sodiumMg).toBe(1100);
    });

    it('does not apply per-serving conversion', () => {
      expect(result.wasPerServing).toBe(false);
    });

    it('has high overall confidence', () => {
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0.6);
    });

    it('does not require user confirmation', () => {
      expect(result.overallConfidence).toBeGreaterThan(0.5);
    });

    it('applies ADR-0007: total sugars as upper bound when no added sugar declared', () => {
      // MAGGI_LIKE_LABEL has Sugars 3.2g but no added sugar field
      // ADR-0007 rule 2: total sugars as upper bound, estimated=true
      expect(result.nutrition.sugarsAddedG).toBe(result.nutrition.sugarsG);
      expect(result.nutrition.sugarsAddedEstimated).toBe(true);
    });
  });

  describe('per-serving label', () => {
    const result = parseLabelText(BISCUIT_PER_SERVING_LABEL);

    it('detects per-serving context', () => {
      expect(result.wasPerServing).toBe(true);
    });

    it('detects serving size', () => {
      expect(result.servingSizeG).toBe(25);
    });

    it('converts calories to per-100g', () => {
      // 120 kcal per 25g → 480 kcal per 100g
      expect(result.nutrition.energyKcal).toBeCloseTo(480);
    });

    it('converts protein to per-100g', () => {
      // 2g per 25g → 8g per 100g
      expect(result.nutrition.proteinG).toBeCloseTo(8);
    });

    it('converts sodium to per-100g', () => {
      // 95mg per 25g → 380mg per 100g
      expect(result.nutrition.sodiumMg).toBeCloseTo(380);
    });
  });

  describe('low-quality OCR', () => {
    const result = parseLabelText(LOW_QUALITY_OCR);

    it('returns lower confidence for degraded OCR', () => {
      expect(result.overallConfidence).toBeLessThanOrEqual(0.8);
    });

    it('has low confidence fields listed', () => {
      expect(result.lowConfidenceFields).toBeDefined();
      expect(Array.isArray(result.lowConfidenceFields)).toBe(true);
    });
  });

  describe('energy consistency', () => {
    it('fills energyKj from energyKcal when kj is absent', () => {
      const r = parseLabelText('Energy 400 kcal\nProtein 5g\nFat 10g\nCarbohydrate 70g\nSodium 100mg');
      // fillEnergyFields should have computed kj = 400 * 4.184 ≈ 1674
      expect(r.nutrition.energyKj).toBeGreaterThan(0);
    });
  });
});

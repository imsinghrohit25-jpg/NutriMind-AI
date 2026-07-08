import { describe, it, expect } from 'vitest';
import { parseLabelText } from '../parser.js';
import { detectLabelFormat } from '../label-formats/detector.js';

const US_LABEL = `
Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)

Amount Per Serving
Calories 230

% Daily Value*
Total Fat 8g 10%
  Saturated Fat 1g 5%
  Trans Fat 0g
Sodium 160mg 7%
Total Carbohydrate 37g 13%
  Total Sugars 12g
    Includes 10g Added Sugars 20%
Protein 3g
Dietary Fiber 4g 14%
`;

const INDIA_LABEL_SAYING_NUTRITION_FACTS = `
Nutrition Facts per serving (25 g)
Calories 120 kcal
Total Fat 4.5 g
Sodium 95 mg
`;

describe('detectLabelFormat', () => {
  it('detects US format from "% Daily Value"', () => {
    expect(detectLabelFormat(US_LABEL)).toBe('us_nfp');
  });

  it('does not misdetect an India-format label that happens to say "Nutrition Facts"', () => {
    expect(detectLabelFormat(INDIA_LABEL_SAYING_NUTRITION_FACTS)).toBe('generic');
  });

  it('defaults to generic for plain FSSAI-style text', () => {
    expect(detectLabelFormat('Energy 390 kcal\nProtein 10.5 g\nSodium 1100 mg')).toBe('generic');
  });

  it('detects US format from "Amount Per Serving" alone', () => {
    expect(detectLabelFormat('Amount Per Serving\nCalories 100')).toBe('us_nfp');
  });
});

describe('parseLabelText — US Nutrition Facts Panel', () => {
  const result = parseLabelText(US_LABEL);

  it('auto-detects the us_nfp format', () => {
    expect(result.labelFormat).toBe('us_nfp');
  });

  it('extracts bare "Calories 230" (no trailing kcal unit) — the real US-format gap', () => {
    // Serving is 55g; per-100g conversion applies since there is no per-100g line.
    expect(result.nutrition.energyKcal).not.toBeNull();
  });

  it('extracts serving size from the "2/3 cup (55g)" parenthetical form', () => {
    expect(result.servingSizeG).toBe(55);
  });

  it('extracts total fat, sodium, and fibre using the shared generic patterns', () => {
    expect(result.nutrition.fatTotalG).not.toBeNull();
    expect(result.nutrition.sodiumMg).not.toBeNull();
    expect(result.nutrition.dietaryFiberG).not.toBeNull();
  });

  it('converts per-serving values to per-100g since US labels have no per-100g line', () => {
    expect(result.wasPerServing).toBe(true);
  });
});

describe('parseLabelText — explicit format override', () => {
  it('an explicit "generic" override is honored even for US-signal text', () => {
    // Forcing generic means the bare "Calories 230" (no unit suffix) pattern won't match,
    // since that variant only exists in the us_nfp pattern set.
    const result = parseLabelText(US_LABEL, 'generic');
    expect(result.labelFormat).toBe('generic');
  });

  it('an explicit "us_nfp" override works even without the % Daily Value signal present', () => {
    const result = parseLabelText('Calories 100\nProtein 5g', 'us_nfp');
    expect(result.labelFormat).toBe('us_nfp');
    expect(result.nutrition.energyKcal).toBe(100);
  });
});

describe('parseLabelText — default call signature is unaffected (backward compatibility)', () => {
  it('calling with one argument still works exactly as before', () => {
    const result = parseLabelText('Energy 390 kcal\nProtein 10.5 g\nSodium 1100 mg');
    expect(result.labelFormat).toBe('generic');
    expect(result.nutrition.energyKcal).toBe(390);
  });
});

import { describe, it, expect } from 'vitest';
import { parseTable3 } from '../ifct/table3-fat-vitamins.js';

// Real excerpts from the actual ICMR-NIN IFCT 2017 book (pdftotext -raw -enc UTF-8 output),
// verified against the book's own printed values (ADR-0031 §5). Covers both real column
// signatures (plant: Ergocalciferol + Vitamin K1; animal: Retinol + Cholecalciferol + Vitamin K2)
// and the Group L (Milk) footnote exception.
const REAL_TABLE3_FIXTURE = `
ERGCAL TOCPHA TOCPHB TOCPHG TOCPHD TOCTRA TOCTRB TOCTRG TOCTRD VITE VITK1
A001 Amaranth seed, black (Amaranthus cruentus) 1 58.67 0.05 0.28 0.04 0.17 1.80
L MILK AND MILK PRODUCTS
L001 Milk, whole, Buffalo 6 0.12±0.02 0.09±0.02 0.10±0.02 0.08±0.02 0.19±0.02
L002 Milk, whole, Cow 6 0.14±0.02 0.11±0.01 0.15±0.02 0.08±0.01 0.22±0.02
a. Retinol (µg): L001- 49.78±4.42; L002-58.25±4.09
RETOL CHOCAL TOCPHA TOCPHB TOCPHG TOCPHD TOCTRA TOCTRB TOCTRG TOCTRD VITE VITK2
M001 Egg, poultry, whole, raw 6 198±6.7 0.84±0.13 1.47±0.41 0.05±0.01 0.02±0.01 0.03±0.02 0.07±0.01 0.01±0.01 0.02±0.01 1.51±0.41 14.61±0.27
`;

describe('parseTable3 (real book excerpts)', () => {
  it('parses a plant-signature row with Ergocalciferol and Vitamin K1 columns', () => {
    const { rows } = parseTable3(REAL_TABLE3_FIXTURE);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.ergocalciferolMcg).toEqual({ value: 58.67, sd: null, state: 'measured' });
    expect(a001.values.tocopherolDeltaMg).toEqual({ value: 0.17, sd: null, state: 'measured' });
    expect(a001.values.retinolMcg).toBeUndefined();
  });

  it('derives vitaminDIu from ergocalciferolMcg via the standard x40 mcg->IU factor', () => {
    const { rows } = parseTable3(REAL_TABLE3_FIXTURE);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.vitaminDIu?.value).toBeCloseTo(58.67 * 40, 1);
  });

  it('switches to the animal signature (Retinol/Cholecalciferol/K2) after the real header change', () => {
    const { rows } = parseTable3(REAL_TABLE3_FIXTURE);
    const m001 = rows.find((r) => r.foodCode === 'M001')!;
    expect(m001.values.retinolMcg).toEqual({ value: 198, sd: 6.7, state: 'measured' });
    expect(m001.values.cholecalciferolMcg).toEqual({ value: 0.84, sd: 0.13, state: 'measured' });
    expect(m001.values.vitaminDIu?.value).toBeCloseTo(0.84 * 40, 1);
    expect(m001.values.ergocalciferolMcg).toBeUndefined();
  });

  it('rejects Group L (Milk) rows rather than mis-mapping the footnoted Retinol/Cholecalciferol data', () => {
    const { rows, rejected } = parseTable3(REAL_TABLE3_FIXTURE);
    expect(rows.find((r) => r.foodGroupCode === 'L')).toBeUndefined();
    const l001 = rejected.find((r) => r.foodCode === 'L001')!;
    expect(l001).toBeDefined();
    expect(l001.reason).toMatch(/footnote/);
    const l002 = rejected.find((r) => r.foodCode === 'L002')!;
    expect(l002).toBeDefined();
  });
});

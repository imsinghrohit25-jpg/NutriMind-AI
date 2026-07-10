import { describe, it, expect } from 'vitest';
import { parseTable6 } from '../ifct/table6-starch-sugars.js';

// Real excerpt from the actual ICMR-NIN IFCT 2017 book. The extracted abbreviation-code line is
// itself missing two of the seven real columns (Total Available CHO, Total Free Sugars) — this
// fixture's own arithmetic (0.10+0.22+0.46+0.10 = 0.88) is the real cross-check that confirmed the
// deduced column order (ADR-0031 §5).
const REAL_TABLE6_FIXTURE = `
STARCH FRUS GLUS SUCS MALS
A001 Amaranth seed, black (Amaranthus cruentus) 1 56.71 55.83 0.10 0.22 0.46 0.10 0.88
A018 Wheat flour, refined (Triticum aestivum) 6 71.82±1.07 70.03±1.01 0.64±0.03 0.75±0.02 0.40±0.05 1.79±0.08
L MILK AND MILK PRODUCTS
L001 1
Milk, whole, Buffalo 6 5.48±0.19
`;

describe('parseTable6 (real book excerpts)', () => {
  it('parses a full 7-value row whose trailing value equals the sum of its own 4 sugar columns', () => {
    const { rows } = parseTable6(REAL_TABLE6_FIXTURE);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.totalStarchG).toEqual({ value: 56.71, sd: null, state: 'measured' });
    expect(a001.values.totalAvailableChoG).toEqual({ value: 55.83, sd: null, state: 'measured' });
    const sumOfSugars = a001.values.fructoseG!.value! + a001.values.glucoseG!.value! + a001.values.sucroseG!.value! + a001.values.maltoseG!.value!;
    expect(a001.values.totalFreeSugarsG!.value).toBeCloseTo(sumOfSugars, 2);
  });

  it('parses a real trailing-shortfall row (6 of 7 columns, no Total Free Sugars printed)', () => {
    const { rows } = parseTable6(REAL_TABLE6_FIXTURE);
    const a018 = rows.find((r) => r.foodCode === 'A018')!;
    expect(a018.values.maltoseG).toEqual({ value: 1.79, sd: 0.08, state: 'measured' });
    expect(a018.values.totalFreeSugarsG).toBeUndefined();
  });

  it('rejects Group L (Milk) rather than guessing through the footnoted/garbled lactose section', () => {
    const { rows, rejected } = parseTable6(REAL_TABLE6_FIXTURE);
    expect(rows.find((r) => r.foodGroupCode === 'L')).toBeUndefined();
    expect(rejected.find((r) => r.foodCode === 'L001')).toBeDefined();
  });
});

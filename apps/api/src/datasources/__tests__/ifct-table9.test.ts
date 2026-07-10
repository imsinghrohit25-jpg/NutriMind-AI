import { describe, it, expect } from 'vitest';
import { parseTable9 } from '../ifct/table9-organic-acids.js';

// Real excerpts from the actual ICMR-NIN IFCT 2017 book. The extracted abbreviation-code line
// only names 5 of the 10 real columns — the rest (Total/Soluble/Insoluble Oxalate, Cis-Aconitic
// Acid, Quinic Acid) were confirmed via captions plus the real arithmetic cross-check this fixture
// itself demonstrates: Soluble + Insoluble Oxalate = Total Oxalate (ADR-0031 §5).
const REAL_TABLE9_FIXTURE = `
CITAC FUMAC MALAC SUCAC TARAC
A001 Amaranth seed, black (Amaranthus cruentus) 1 226 37.43 188 8.64 0.15 45.78 75.53 1.47
C014 Cabbage, collard greens (Brassica oleracea var. viridis) 1 9.42 0.80 8.62 0.03 45.82 0.81 0.55 58.30 89.66 2.98
`;

describe('parseTable9 (real book excerpts)', () => {
  it('parses a partial row whose Soluble+Insoluble Oxalate equals Total Oxalate', () => {
    const { rows, rejected } = parseTable9(REAL_TABLE9_FIXTURE);
    expect(rejected).toEqual([]);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.totalOxalateMg!.value).toBe(226);
    expect(Math.abs(a001.values.solubleOxalateMg!.value! + a001.values.insolubleOxalateMg!.value! - 226)).toBeLessThan(1);
    expect(a001.values.quinicAcidMg).toEqual({ value: 1.47, sd: null, state: 'measured' });
  });

  it('parses a real full 10-value row, confirming the otherwise-unlabeled Quinic Acid column', () => {
    const { rows } = parseTable9(REAL_TABLE9_FIXTURE);
    const c014 = rows.find((r) => r.foodCode === 'C014')!;
    expect(c014.values.quinicAcidMg!.value).toBe(58.30);
    expect(c014.values.succinicAcidMg!.value).toBe(89.66);
    expect(c014.values.tartaricAcidMg!.value).toBe(2.98);
    expect(c014.values.solubleOxalateMg!.value! + c014.values.insolubleOxalateMg!.value!).toBeCloseTo(c014.values.totalOxalateMg!.value!, 1);
  });
});

import { describe, it, expect } from 'vitest';
import { parseTable2 } from '../ifct/table2-water-vitamins.js';

// Real excerpts from the actual ICMR-NIN IFCT 2017 book (pdftotext -raw -enc UTF-8 output),
// verified against the book's own printed values (ADR-0031 §5). Covers all three real column
// signatures this table uses (full 8-column, 7-column with no Vitamin C, 6-column with neither
// Biotin nor Vitamin C) and the literal "NA" interior marker.
const REAL_TABLE2_FIXTURE = `
THIA RIBF NIA PANTAC VITB6A BIOT FOLSUM VITC
A019 Wheat flour, atta (Triticum aestivum) 6 0.42±0.044 0.15±0.010 2.37±0.10 0.87±0.04 0.25±0.032 0.76±0.12 29.22±1.92
N012 Emu, meat, skinless 1 0.10 0.17 3.26 2.21 0.35 NA 7.07
THIA RIBF NIA PANTAC VITB6A FOLSUM
O001 Goat, shoulder 6 0.07±0.01 0.17±0.01 5.14±0.56 1.07±0.10 0.26±0.03 2.08±0.44
`;

describe('parseTable2 (real book excerpts)', () => {
  it('parses a full 8-column row with zero rejections', () => {
    const { rows, rejected } = parseTable2(REAL_TABLE2_FIXTURE);
    expect(rejected).toEqual([]);
    const a019 = rows.find((r) => r.foodCode === 'A019')!;
    expect(a019.foodNameEn).toBe('Wheat flour, atta (Triticum aestivum)');
    expect(a019.values.thiamineMg).toEqual({ value: 0.42, sd: 0.044, state: 'measured' });
    expect(a019.values.folateMcg).toEqual({ value: 29.22, sd: 1.92, state: 'measured' });
    expect(a019.values.vitaminCMg).toBeUndefined(); // never claimed for this row — genuinely absent
  });

  it('parses a literal interior "NA" (Not Analysed) marker without shifting later columns', () => {
    const { rows } = parseTable2(REAL_TABLE2_FIXTURE);
    const n012 = rows.find((r) => r.foodCode === 'N012')!;
    expect(n012.values.vitaminB6Mg).toEqual({ value: 0.35, sd: null, state: 'measured' });
    expect(n012.values.biotinMcg).toEqual({ value: null, sd: null, state: 'not_analyzed' });
    // Folate correctly still lands in its own slot, not shifted by the NA marker before it.
    expect(n012.values.folateMcg).toEqual({ value: 7.07, sd: null, state: 'measured' });
  });

  it('switches active columns on a new page signature (Group O: no Biotin, no Vitamin C at all)', () => {
    const { rows } = parseTable2(REAL_TABLE2_FIXTURE);
    const o001 = rows.find((r) => r.foodCode === 'O001')!;
    expect(o001.values.pantothenicAcidMg).toEqual({ value: 1.07, sd: 0.1, state: 'measured' });
    expect(o001.values.folateMcg).toEqual({ value: 2.08, sd: 0.44, state: 'measured' });
    expect(o001.values.biotinMcg).toBeUndefined(); // this whole page never covers biotin
    expect(o001.values.vitaminCMg).toBeUndefined();
  });

  it('rejects a row whose token count matches none of its active signature shapes rather than guessing', () => {
    // 8 values under the 6-column Group-O signature — not a valid shape, never positionally mapped.
    const bogus = 'THIA RIBF NIA PANTAC VITB6A FOLSUM\nO999 Bogus meat 1 0.1 0.1 1.0 1.0 0.1 1.0 99.0 5.0';
    const { rows, rejected } = parseTable2(bogus);
    expect(rows).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.foodCode).toBe('O999');
  });
});

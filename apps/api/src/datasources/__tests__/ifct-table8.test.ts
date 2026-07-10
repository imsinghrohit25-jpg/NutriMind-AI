import { describe, it, expect } from 'vitest';
import { parseTable8 } from '../ifct/table8-amino-acids.js';

// Real excerpts from `pdftotext -table` output against the actual ICMR-NIN IFCT 2017 book
// (ADR-0031 §5 addendum). The earlier reading-order attempt never enumerated the non-essential
// amino acid section at all (Alanine..Tyrosine) — ~120 rows rejected into one garbled text blob
// that, on inspection, turned out to BE this entire second section. Position-aware parsing (with
// "No. of Regions" printing on the same physical line as both signatures' labels here) resolves
// both cleanly.
const REAL_TABLE8_FIXTURE = `
                                                                                          No. of Regions  Histidine  Isoleucine  Luecine     Lysine     Methionine     Cystine    Phenylalanine  Threonine  Tryptophan  Valine
                                A001       Amaranth seed, black (Amaranthus            1               1.86       2.82        4.83        5.45       1.86           1.60       3.98           3.02       1.50        4.34
                                                                                          No. of Regions  Alanine    Arginine   Aspartic Acid  Glutamic Acid     Glycine    Proline     Serine     Tyrosine
                                A001       Amaranth seed, black (Amaranthus            1               4.26       7.77       12.57          16.12             8.50       3.76        7.79       2.85
`;

describe('parseTable8 (position-aware, real book excerpts)', () => {
  it('parses the essential amino acid signature (with its real typo, Luecine, mapped correctly)', () => {
    const { rows, rejected } = parseTable8(REAL_TABLE8_FIXTURE);
    expect(rejected).toEqual([]);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.histidineGPer100gProtein).toEqual({ value: 1.86, sd: null, state: 'measured' });
    expect(a001.values.leucineGPer100gProtein).toEqual({ value: 4.83, sd: null, state: 'measured' });
    expect(a001.values.valineGPer100gProtein).toEqual({ value: 4.34, sd: null, state: 'measured' });
  });

  it('parses the non-essential amino acid section that the reading-order attempt never found at all', () => {
    const { rows } = parseTable8(REAL_TABLE8_FIXTURE);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.glutamicAcidGPer100gProtein).toEqual({ value: 16.12, sd: null, state: 'measured' });
    expect(a001.values.alanineGPer100gProtein).toEqual({ value: 4.26, sd: null, state: 'measured' });
    expect(a001.values.tyrosineGPer100gProtein).toEqual({ value: 2.85, sd: null, state: 'measured' });
  });

  it('merges both signature occurrences of the same food into one row', () => {
    const { rows } = parseTable8(REAL_TABLE8_FIXTURE);
    const occurrences = rows.filter((r) => r.foodCode === 'A001');
    expect(occurrences).toHaveLength(1);
    expect(Object.keys(occurrences[0]!.values)).toHaveLength(18);
  });
});

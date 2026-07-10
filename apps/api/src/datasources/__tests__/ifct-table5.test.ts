import { describe, it, expect } from 'vitest';
import { parseTable5 } from '../ifct/table5-minerals.js';

// Real excerpts from `pdftotext -table` output against the actual ICMR-NIN IFCT 2017 book
// (ADR-0031 §5 addendum — position-aware re-extraction). Table 5 prints two column signatures as
// alternating page-halves (Aluminium..Lithium, then Magnesium..Zinc); each food appears once per
// half, and `-table` mode's preserved column x-positions are the real cross-check that resolved
// this table's earlier reading-order ambiguity: Almond's Calcium (228mg) sits at the real
// x-position under "Calcium", independent of Arsenic/Cadmium being genuinely blank for this food.
const REAL_TABLE5_FIXTURE = `
                                                                                              No. of Regions  Aluminium   Arsenic      Cadmium      Calcium   Chromium     Cobalt       Copper     Iron        Lead         Lithium
                                      H001          Almond (Prunus amygdalus)                 6               0.88±0.32                             228±10.2  0.006±0.003  0.007±0.002  1.08±0.06  4.59±0.61   0.002±0.002  0.001±0.001
Table 5. Minerals and Trace Elements                                                          No. of Regions  Magnesium    Manganese  Mercury    Molebdenum   Nickel       Phosphorus   Potassium  Selenium     Sodium      Zinc
                                      H001          Almond (Prunus amygdalus)                 6               318±49.5     2.54±0.20             0.033±0.012  0.130±0.027  446±23.2     699±43.4   3.61±1.30    1.50±0.51   3.50±0.10
`;

describe('parseTable5 (position-aware, real book excerpts)', () => {
  it('assigns a value to its real column by x-position, not by counting tokens in order', () => {
    const { rows, rejected } = parseTable5(REAL_TABLE5_FIXTURE);
    expect(rejected).toEqual([]);
    const h001 = rows.find((r) => r.foodCode === 'H001')!;
    // Arsenic and Cadmium are genuinely blank for Almond — Calcium must NOT inherit their slot.
    expect(h001.values.arsenicMcg).toBeUndefined();
    expect(h001.values.cadmiumMg).toBeUndefined();
    expect(h001.values.calciumMg).toEqual({ value: 228, sd: 10.2, state: 'measured' });
    expect(h001.values.aluminumMg).toEqual({ value: 0.88, sd: 0.32, state: 'measured' });
  });

  it('merges a foods two per-signature-page occurrences into one row', () => {
    const { rows } = parseTable5(REAL_TABLE5_FIXTURE);
    const occurrences = rows.filter((r) => r.foodCode === 'H001');
    expect(occurrences).toHaveLength(1);
    const h001 = occurrences[0]!;
    expect(h001.values.calciumMg?.value).toBe(228);
    expect(h001.values.potassiumMg).toEqual({ value: 699, sd: 43.4, state: 'measured' });
    expect(h001.values.magnesiumMg).toEqual({ value: 318, sd: 49.5, state: 'measured' });
  });
});

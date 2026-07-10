import { describe, it, expect } from 'vitest';
import { parseTable10 } from '../ifct/table10-polyphenols.js';

// A tiny real excerpt from the cross-validated structured CSV dataset (ADR-0031 §5 addendum) —
// the same header shape as the full file, with just two real foods. Values for C028 (Parsley)
// were independently cross-validated against this session's own `-table` position-derived
// extraction before this CSV was trusted for Table 10 at all (see table10-polyphenols.ts).
const HEADER = 'code,name,scie,regn,vanlac,vanlac_e,gallac,gallac_e,coumaco,coumaco_e,coumacp,coumacp_e,caffac,caffac_e,chlrac,chlrac_e,ferac,ferac_e,apigen,apigen_e,luteol,luteol_e,kaemf,kaemf_e,querce,querce_e';
const ROWS = [
  'C028,Parsley,Petroselinum crispum,3,1.18,0.09,0,0,0.41,0,0.02,0,0.27,0.04,1.52,0.31,0.33,0.02,16.14,1.41,0,0,0.01,0.01,0,0',
  'C029,Ponnaganni,Alternanthera sessilis,2,0,0,0,0,0,0,0,0,0,0,null,null,null,null,0.31,0,4.98,0,0.75,0,0.56,0',
];
const REAL_TABLE10_CSV_FIXTURE = [HEADER, ...ROWS].join('\n');

describe('parseTable10 (CSV-based, cross-validated real data)', () => {
  it('parses a real row with values cross-validated against independent position-based extraction', () => {
    const { rows, rejected } = parseTable10(REAL_TABLE10_CSV_FIXTURE);
    expect(rejected).toEqual([]);
    const c028 = rows.find((r) => r.foodCode === 'C028')!;
    expect(c028.values.vanillicAcidMg).toEqual({ value: 1.18, sd: 0.09, state: 'measured' });
    expect(c028.values.chlorogenicAcidMg).toEqual({ value: 1.52, sd: 0.31, state: 'measured' });
    expect(c028.values.apigeninMg).toEqual({ value: 16.14, sd: 1.41, state: 'measured' });
  });

  it('distinguishes a real measured zero from the literal "null" not-analyzed marker', () => {
    const { rows } = parseTable10(REAL_TABLE10_CSV_FIXTURE);
    const c029 = rows.find((r) => r.foodCode === 'C029')!;
    expect(c029.values.gallicAcidMg).toEqual({ value: 0, sd: 0, state: 'zero' });
    expect(c029.values.chlorogenicAcidMg).toBeUndefined(); // literal "null" in the source
    expect(c029.values.luteolinMg).toEqual({ value: 4.98, sd: 0, state: 'measured' });
  });
});

import { describe, it, expect } from 'vitest';
import { parseTable11 } from '../ifct/table11-oligo-phyto.js';

// A real excerpt from the cross-validated structured CSV dataset (ADR-0031 §5 addendum). Values
// independently cross-validated against this session's own `-table` position-derived extraction
// for the same two foods before this CSV was trusted for this table at all.
const HEADER = 'code,name,scie,regn,rafs,rafs_e,stas,stas_e,vers,vers_e,ajgs,ajgs_e,camt,camt_e,stgstr,stgstr_e,stostrb,stostrb_e,phytac,phytac_e,sapon,sapon_e';
const ROWS = [
  'A001,"Amaranth seed, black",Amaranthus cruentus,1,0,0,0,0,0,0,0,0,1.75,0,8.24,0,61.36,0,393,0,1.42,0',
  'A008,"Maize, tender, sweet",Zea mays,4,0,0,0,0,0,0,0,0,5.63,0.06,2.63,0.06,41.71,0.52,221,17.1,0,0',
];
const REAL_TABLE11_CSV_FIXTURE = [HEADER, ...ROWS].join('\n');

describe('parseTable11 (CSV-based, cross-validated real data)', () => {
  it('parses phytosterol/phytate values matching independent position-based extraction', () => {
    const { rows, rejected } = parseTable11(REAL_TABLE11_CSV_FIXTURE);
    expect(rejected).toEqual([]);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.campesterolMg).toEqual({ value: 1.75, sd: 0, state: 'measured' });
    expect(a001.values.stigmasterolMg).toEqual({ value: 8.24, sd: 0, state: 'measured' });
    expect(a001.values.betaSitosterolMg).toEqual({ value: 61.36, sd: 0, state: 'measured' });
    expect(a001.values.phytateMg).toEqual({ value: 393, sd: 0, state: 'measured' });
  });

  it('parses a second real cross-validated row with real SD values', () => {
    const { rows } = parseTable11(REAL_TABLE11_CSV_FIXTURE);
    const a008 = rows.find((r) => r.foodCode === 'A008')!;
    expect(a008.values.campesterolMg).toEqual({ value: 5.63, sd: 0.06, state: 'measured' });
    expect(a008.values.phytateMg).toEqual({ value: 221, sd: 17.1, state: 'measured' });
  });
});

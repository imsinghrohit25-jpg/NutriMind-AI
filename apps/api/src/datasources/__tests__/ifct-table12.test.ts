import { describe, it, expect } from 'vitest';
import { parseTable12 } from '../ifct/table12-edible-oils.js';

// A real excerpt from the cross-validated structured CSV dataset (ADR-0031 §5 addendum). Coconut
// oil's real Lauric-acid dominance (~48-50% of its fat, textbook chemistry) is the exact value
// that invalidated the earlier reading-order extraction attempt at this table (which had read
// Lauric as a minor 9% instead) — confirmed here via the CSV, independently cross-validated.
const HEADER = 'code,name,scie,regn,f4d0,f4d0_e,f6d0,f6d0_e,f8d0,f8d0_e,f10d0,f10d0_e,f12d0,f12d0_e,f14d0,f14d0_e,f16d0,f16d0_e,f18d0,f18d0_e,f20d0,f20d0_e,f22d0,f22d0_e,f24d0,f24d0_e,fasat,fasat_e,fams,fams_e,fapu,fapu_e';
const ROWS = [
  'T001,Coconut oil,,6,0,0,0,0,2.76,0.37,5.18,0.2,49.57,0.81,21.12,0.67,9.26,0.39,2.97,0.23,0,0,0,0,0,0,90.86,0,7.24,0,1.9,0',
  'A001,"Amaranth seed, black",Amaranthus cruentus,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
];
const REAL_TABLE12_CSV_FIXTURE = [HEADER, ...ROWS].join('\n');

describe('parseTable12 (CSV-based, cross-validated real data)', () => {
  it('resolves coconut oils real Lauric-acid dominance that the reading-order attempt got wrong', () => {
    const { rows, rejected } = parseTable12(REAL_TABLE12_CSV_FIXTURE);
    expect(rejected).toEqual([]);
    const t001 = rows.find((r) => r.foodCode === 'T001')!;
    expect(t001.values.lauricAcidPct).toEqual({ value: 49.57, sd: 0.81, state: 'measured' });
    expect(t001.values.caprylicAcidPct).toEqual({ value: 2.76, sd: 0.37, state: 'measured' });
    expect(t001.values.fatSaturatedPct?.value).toBe(90.86);
  });

  it('only includes Group T (Edible Oils and Fats) foods', () => {
    const { rows } = parseTable12(REAL_TABLE12_CSV_FIXTURE);
    expect(rows.find((r) => r.foodCode === 'A001')).toBeUndefined();
    expect(rows.every((r) => r.foodGroupCode === 'T')).toBe(true);
  });
});

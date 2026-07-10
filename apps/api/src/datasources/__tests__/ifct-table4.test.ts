import { describe, it, expect } from 'vitest';
import { parseTable4 } from '../ifct/table4-carotenoids.js';

// Real excerpts from the actual ICMR-NIN IFCT 2017 book — covers a normal partial-column row and
// the real "zero carotenoids at all" case (mushrooms/toddy/egg white: a food genuinely listed with
// only a region count and no values whatsoever, not a parse failure).
const REAL_TABLE4_FIXTURE = `
LUTN ZEA LYCPN CRYPXB CARTG CARTA CARTB CARTOID
A001 Amaranth seed, black (Amaranthus cruentus) 1 10.25 121
J001 Button mushroom, fresh (Agaricus sp.) 1
K001 Toddy (Borassus flabellifer) 10
`;

describe('parseTable4 (real book excerpts)', () => {
  it('parses a real partial-column row (trailing shortfall against the single signature)', () => {
    const { rows, rejected } = parseTable4(REAL_TABLE4_FIXTURE);
    expect(rejected).toEqual([]);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.values.luteinMcg).toEqual({ value: 10.25, sd: null, state: 'measured' });
    expect(a001.values.zeaxanthinMcg).toEqual({ value: 121, sd: null, state: 'measured' });
    expect(a001.values.lycopeneMcg).toBeUndefined();
  });

  it('accepts a real zero-carotenoid row (region count present, no values at all) rather than rejecting it', () => {
    const { rows, rejected } = parseTable4(REAL_TABLE4_FIXTURE);
    const j001 = rows.find((r) => r.foodCode === 'J001')!;
    expect(j001).toBeDefined();
    expect(j001.noOfRegions).toBe(1);
    expect(Object.keys(j001.values)).toHaveLength(0);
    expect(rejected.find((r) => r.foodCode === 'J001')).toBeUndefined();

    const k001 = rows.find((r) => r.foodCode === 'K001')!;
    expect(k001.noOfRegions).toBe(10); // real: sampled more than once within a region
    expect(Object.keys(k001.values)).toHaveLength(0);
  });
});

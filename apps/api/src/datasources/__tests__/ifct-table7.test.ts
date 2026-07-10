import { describe, it, expect } from 'vitest';
import { parseTable7 } from '../ifct/table7-fatty-acids.js';

// Real excerpts from `pdftotext -table` output against the actual ICMR-NIN IFCT 2017 book
// (ADR-0031 §5 addendum). The earlier reading-order attempt at this table produced an impossible
// 18.5g lignoceric-acid reading for Pistachio (H018) — more mass than the food's entire fat
// content — because a silently-blank interior column (Capric/Lauric, not analyzed for this food)
// shifted every later value left by one position. Position-aware parsing resolves this: the first
// real value sits at Myristic's own print x-position, not Capric's.
const REAL_TABLE7_FIXTURE = `
                                                                                                    F10D0      F12D0        F14D0       F16D0       F18D0           F20D0       F22D0       F24D0       F14D1        F16D1        F18D1N9
                             A001       Amaranth seed, black (Amaranthus            1                                       15.64       1043        155             38.00       16.07       12.14                                 1020
                             H018          Pistachio nuts (Pistacia vera)            6                                     39.96±3.16   3473±81.9  425±34.4    49.82±2.80   38.10±7.85   18.11±3.13               285±12.9     18478±209
`;

describe('parseTable7 (position-aware, real book excerpts)', () => {
  it('assigns values by real print position, not by counting them in order', () => {
    const { rows, rejected } = parseTable7(REAL_TABLE7_FIXTURE);
    expect(rejected).toEqual([]);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    // Capric and Lauric are genuinely blank for this food — Myristic must not inherit their slot.
    expect(a001.values.capricAcidMg).toBeUndefined();
    expect(a001.values.lauricAcidMg).toBeUndefined();
    expect(a001.values.myristicAcidMg).toEqual({ value: 15.64, sd: null, state: 'measured' });
    expect(a001.values.oleicAcidMg).toEqual({ value: 1020, sd: null, state: 'measured' });
  });

  it('resolves the Pistachio lignoceric/oleic mismatch that blocked the reading-order attempt', () => {
    const { rows } = parseTable7(REAL_TABLE7_FIXTURE);
    const h018 = rows.find((r) => r.foodCode === 'H018')!;
    // Lignoceric must be its own real trace value (18.11mg), never conflated with Oleic (18478mg)
    // the way pure reading-order counting did (the bug that originally blocked this table).
    expect(h018.values.lignocericAcidMg).toEqual({ value: 18.11, sd: 3.13, state: 'measured' });
    expect(h018.values.oleicAcidMg).toEqual({ value: 18478, sd: 209, state: 'measured' });
  });
});

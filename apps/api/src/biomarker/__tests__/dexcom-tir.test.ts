// Time-in-range computation tests — deterministic, no network.

import { describe, it, expect } from 'vitest';
import { computeTimeInRange } from '../dexcom.js';

function buildMockSupabase(values: number[]) {
  const data = values.map((v) => ({ value_mgdl: v }));
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            lte: () => Promise.resolve({ data, error: null }),
          }),
        }),
      }),
    }),
  };
}

describe('computeTimeInRange', () => {
  const FROM = new Date('2026-07-01T00:00:00Z');
  const TO   = new Date('2026-07-07T23:59:59Z');

  it('returns zeros for no readings', async () => {
    const mock = buildMockSupabase([]);
    const r = await computeTimeInRange('user-1', FROM, TO, mock as never);
    expect(r.readings).toBe(0);
    expect(r.inRange).toBe(0);
    expect(r.meanGlucose).toBe(0);
  });

  it('correctly classifies glucose ranges', async () => {
    // 4 readings: one per tier
    const values = [40, 60, 100, 200, 300];
    const mock   = buildMockSupabase(values);
    const r = await computeTimeInRange('user-1', FROM, TO, mock as never);
    expect(r.readings).toBe(5);
    expect(r.veryLow).toBe(20);   // 40 mg/dL → 1/5 = 20%
    expect(r.low).toBe(20);       // 60 mg/dL → 1/5
    expect(r.inRange).toBe(20);   // 100 mg/dL
    expect(r.high).toBe(20);      // 200 mg/dL
    expect(r.veryHigh).toBe(20);  // 300 mg/dL
  });

  it('computes GMI correctly for known mean', async () => {
    // Mean = 154 mg/dL → GMI = 3.31 + 0.02392 × 154 = 3.31 + 3.684 = 6.994 ≈ 7.0
    const values = Array(10).fill(154) as number[];
    const mock   = buildMockSupabase(values);
    const r = await computeTimeInRange('user-1', FROM, TO, mock as never);
    expect(r.meanGlucose).toBe(154);
    expect(r.gmi).toBeCloseTo(7.0, 1);
    expect(r.cv).toBe(0);   // all same value → no variance
  });

  it('computes CV for variable readings', async () => {
    const values = [70, 90, 110, 130, 150];
    const mock   = buildMockSupabase(values);
    const r = await computeTimeInRange('user-1', FROM, TO, mock as never);
    expect(r.cv).toBeGreaterThan(0);
    expect(r.meanGlucose).toBe(110);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IfctLoader } from '../ifct/loader.js';
import { runTable1SpotChecks } from '../ifct/spot-check.js';

// Real excerpts from the actual ICMR-NIN IFCT 2017 book (same extraction convention as
// ifct-parser.test.ts), covering the four foods spot-check.ts asserts against.
const REAL_TABLE1_FIXTURE = `
A015 Rice, raw, milled (Oryza sativa ) 6 9.93±0.75 7.94±0.58 0.56±0.08 0.52±0.05 2.81±0.42 1.99±0.39 0.82±0.22 78.24±1.07 1491±15
A018 Wheat flour, refined (Triticum aestivum) 6 11.34±0.93 10.36±0.29 0.51±0.07 0.76±0.07 2.76±0.29 2.14±0.30 0.62±0.14 74.27±0.92 1472±16
E012 Banana, ripe, robusta (Musa x paradisiaca) 6 71.93±0.85 1.23±0.08 0.94±0.17 0.33±0.01 1.94±0.07 1.23±0.10 0.71±0.07 23.63±0.74 440±14
L001 Milk, whole, Buffalo 6 80.68±0.66 3.68±0.13 0.67±0.02 6.58±0.20 8.39±0.71 449±9
`;

describe('runTable1SpotChecks (real book excerpts)', () => {
  let tmpDir: string;
  let loader: IfctLoader;

  beforeAll(async () => {
    tmpDir = join(tmpdir(), `ifct-spot-check-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'table1_proximates_raw.txt'), REAL_TABLE1_FIXTURE, 'utf8');
    loader = new IfctLoader();
    await loader.load(tmpDir);
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('passes all four reference foods against the real book values', () => {
    const results = runTable1SpotChecks(loader);
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.mismatches).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });

  it('flags a mismatch when a loaded entry disagrees with the expected reference value', async () => {
    const badDir = join(tmpdir(), `ifct-spot-check-bad-${Date.now()}`);
    mkdirSync(badDir, { recursive: true });
    // Corrupted protein value for A015 (7.94 -> 9.00) — simulates a column-shift regression.
    const corrupted = REAL_TABLE1_FIXTURE.replace('7.94±0.58', '9.00±0.58');
    writeFileSync(join(badDir, 'table1_proximates_raw.txt'), corrupted, 'utf8');
    const badLoader = new IfctLoader();
    await badLoader.load(badDir);

    const results = runTable1SpotChecks(badLoader);
    const a015 = results.find((r) => r.foodCode === 'A015')!;
    expect(a015.ok).toBe(false);
    expect(a015.mismatches[0]).toMatch(/proteinG: expected 7.94, got 9/);

    try { rmSync(badDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('reports a clear failure when a reference food is absent from the loaded dataset', async () => {
    const emptyDir = join(tmpdir(), `ifct-spot-check-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });
    writeFileSync(join(emptyDir, 'table1_proximates_raw.txt'), 'A015 Rice, raw, milled (Oryza sativa ) 6 9.93±0.75 7.94±0.58 0.56±0.08 0.52±0.05 2.81±0.42 1.99±0.39 0.82±0.22 78.24±1.07 1491±15\n', 'utf8');
    const partialLoader = new IfctLoader();
    await partialLoader.load(emptyDir);

    const results = runTable1SpotChecks(partialLoader);
    const missing = results.find((r) => r.foodCode === 'L001')!;
    expect(missing.ok).toBe(false);
    expect(missing.mismatches).toEqual(['not found in loaded dataset']);

    try { rmSync(emptyDir, { recursive: true, force: true }); } catch { /* ok */ }
  });
});

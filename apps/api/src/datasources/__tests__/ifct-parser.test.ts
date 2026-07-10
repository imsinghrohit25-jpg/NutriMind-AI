import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTable1 } from '../ifct/book-parser.js';
import { validateTable1 } from '../ifct/validate-table1.js';
import { table1RowToEntry, type IfctEntry } from '../ifct/parser.js';
import { IfctLoader, IfctDatasetMissingError, entryToNutrition, entryToCanonicalProduct } from '../ifct/loader.js';

// Real excerpts from the actual ICMR-NIN IFCT 2017 book (pdftotext -raw -enc UTF-8 output),
// verified against the book's own printed values — not synthetic/invented data (ADR-0031).
// Covers: a plain single-line entry, a name that wraps across two lines (a real PDF text-run
// quirk this book exhibits), a 6-column row (milk: has real carbohydrate/lactose, no fibre), and
// a 5-column row (egg: neither carbohydrate nor fibre tabulated in this table).
const REAL_TABLE1_FIXTURE = `
A001 Amaranth seed, black (Amaranthus cruentus) 1 9.89 14.59 2.78 5.74 7.02 5.76 1.26 59.98 1490
A002
Amaranth seed, pale brown (Amaranthus
cruentus)
6 9.20±0.40 13.27±0.34 3.05±0.30 5.56±0.33 7.47±0.09 5.80±0.17 1.67±0.21 61.46±0.60 1489±10
L002 Milk, whole, Cow 6 86.64±1.10 3.26±0.06 0.68±0.02 4.48±0.29 4.94±1.02 305±23
M002 Egg, poultry, white, raw 6 86.68±0.11 10.84±0.07 0.75±0.03 0.06±0.01 187±1
`;

describe('parseTable1 (real book excerpts)', () => {
  it('parses all four real rows with zero rejections', () => {
    const result = parseTable1(REAL_TABLE1_FIXTURE);
    expect(result.rejected).toEqual([]);
    expect(result.rows).toHaveLength(4);
  });

  it('parses a plain single-line entry correctly (9 columns: full proximate + fibre set)', () => {
    const { rows } = parseTable1(REAL_TABLE1_FIXTURE);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    expect(a001.foodNameEn).toBe('Amaranth seed, black (Amaranthus cruentus)');
    expect(a001.noOfRegions).toBe(1);
    expect(a001.moisture).toEqual({ value: 9.89, sd: null, state: 'measured' });
    expect(a001.fiberTotal.value).toBe(7.02);
    expect(a001.carbohydrates.value).toBe(59.98);
    expect(a001.energyKj.value).toBe(1490);
    expect(a001.nameReconstructed).toBe(false);
  });

  it('reassembles a food name that wraps across multiple physical lines', () => {
    const { rows } = parseTable1(REAL_TABLE1_FIXTURE);
    const a002 = rows.find((r) => r.foodCode === 'A002')!;
    expect(a002.foodNameEn).toBe('Amaranth seed, pale brown (Amaranthus cruentus)');
    expect(a002.nameReconstructed).toBe(true);
    expect(a002.moisture).toEqual({ value: 9.20, sd: 0.40, state: 'measured' });
  });

  it('maps a real 6-column row (milk: carbohydrate present, no fibre breakdown)', () => {
    const { rows } = parseTable1(REAL_TABLE1_FIXTURE);
    const milk = rows.find((r) => r.foodCode === 'L002')!;
    expect(milk.moisture.value).toBe(86.64);
    expect(milk.fatTotal.value).toBe(4.48);
    expect(milk.carbohydrates.value).toBe(4.94); // real lactose content
    expect(milk.fiberTotal.state).toBe('not_analyzed');
    expect(milk.energyKj.value).toBe(305);
  });

  it('maps a real 5-column row (egg: no carbohydrate or fibre tabulated at all)', () => {
    const { rows } = parseTable1(REAL_TABLE1_FIXTURE);
    const egg = rows.find((r) => r.foodCode === 'M002')!;
    expect(egg.fatTotal.value).toBe(0.06);
    expect(egg.carbohydrates.state).toBe('not_analyzed');
    expect(egg.fiberTotal.state).toBe('not_analyzed');
    expect(egg.energyKj.value).toBe(187);
  });

  it('never guesses a column mapping for a value count matching none of the three real shapes (5/6/9)', () => {
    // 8 values doesn't match any real Table 1 shape — tryParseDataTail refuses to treat this as a
    // data row at all (rather than mis-map it), so it's carried as an unresolved pending entry to
    // the end of input and reported that way — still a real, honest rejection, never a guess.
    const bogus = 'A999 Bogus food 1 1.0 2.0 3.0 4.0 5.0 6.0 7.0 8.0';
    const { rows, rejected } = parseTable1(bogus);
    expect(rows).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.foodCode).toBe('A999');
  });

  it("does not mistake a digit embedded in a food name (e.g. a hyphenated cultivar number) for the region count", () => {
    const line = 'D999 Brinjal-1 (Solanum melongena) 1 89.95 1.77 0.83 0.39 3.57 2.37 1.20 3.49 114';
    const { rows, rejected } = parseTable1(line);
    expect(rejected).toEqual([]);
    expect(rows[0]!.foodNameEn).toBe('Brinjal-1 (Solanum melongena)');
    expect(rows[0]!.noOfRegions).toBe(1);
  });

  it('accepts a region/sample count above 6 (real: some foods are sampled more than once per region)', () => {
    const line = 'K999 Toddy (Borassus flabellifer) 10 93.86±0.59 0.18±0.05 0.21±0.03 0.03±0.01 5.72±0.55 101±10';
    const { rows } = parseTable1(line);
    expect(rows[0]!.noOfRegions).toBe(10);
  });
});

describe('validateTable1', () => {
  it('passes real, internally-consistent rows', () => {
    const { rows } = parseTable1(REAL_TABLE1_FIXTURE);
    const { valid, results } = validateTable1(rows);
    expect(valid).toHaveLength(4);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('rejects a row whose reported energy grossly contradicts its own macros (Atwater hard bound)', () => {
    // Real macros (protein/fat) from M001 but with a reported energy far outside any plausible
    // Atwater range for those macros — a genuine column-shift-style corruption, not real variance.
    const line = 'M999 Corrupted egg 6 76.51 13.28 0.81 9.15 5000';
    const { rows } = parseTable1(line);
    const { valid, results } = validateTable1(rows);
    expect(valid).toHaveLength(0);
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.rejectionReason).toMatch(/Atwater estimate/);
  });
});

describe('table1RowToEntry', () => {
  it('builds a real IfctEntry from a validated row, leaving not-yet-integrated fields honestly null', () => {
    const { rows } = parseTable1(REAL_TABLE1_FIXTURE);
    const a001 = rows.find((r) => r.foodCode === 'A001')!;
    const entry = table1RowToEntry(a001);

    expect(entry.foodCode).toBe('A001');
    expect(entry.proteinG).toBe(14.59);
    expect(entry.energyKj).toBe(1490);
    expect(entry.energyKcal).toBeCloseTo(1490 / 4.184, 1);
    // Not covered by Table 1 — must stay null, never guessed.
    expect(entry.calciumMg).toBeNull();
    expect(entry.vitaminB12Mcg).toBeNull();
    expect(entry.foodNameHi).toBe('');
  });

  it('records per-nutrient SD only where the book reported one', () => {
    const { rows } = parseTable1(REAL_TABLE1_FIXTURE);
    const a002 = rows.find((r) => r.foodCode === 'A002')!;
    const entry = table1RowToEntry(a002);
    expect(entry.sd.proteinG).toBeCloseTo(0.34, 2);
    expect(entry.valueState.proteinG).toBe('measured');
  });
});

describe('IfctLoader (real Table 1 fixture on disk)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `ifct-loader-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'table1_proximates_raw.txt'), REAL_TABLE1_FIXTURE, 'utf8');
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('loads real entries from disk and becomes available', async () => {
    const loader = new IfctLoader();
    await loader.load(tmpDir);
    expect(loader.isAvailable()).toBe(true);
    expect(loader.count).toBe(4);
  });

  it('finds a real entry by code and by name substring', async () => {
    const loader = new IfctLoader();
    await loader.load(tmpDir);
    expect(loader.findByCode('a001')?.foodNameEn).toContain('Amaranth seed, black');
    expect(loader.searchByName('milk')).toHaveLength(1);
  });

  it('exposes the real import report (counts, zero rejections for this clean fixture)', async () => {
    const loader = new IfctLoader();
    await loader.load(tmpDir);
    const report = loader.getImportReport();
    expect(report?.totalValid).toBe(4);
    expect(report?.totalRejectedAtValidation).toBe(0);
  });

  it('raises IfctDatasetMissingError for a missing file, never fabricating data', async () => {
    const loader = new IfctLoader();
    await loader.load('/nonexistent/path/');
    expect(loader.isAvailable()).toBe(false);
    expect(() => loader.requireAvailable()).toThrow(IfctDatasetMissingError);
  });

  it('searchByName returns empty when not loaded', async () => {
    const loader = new IfctLoader();
    expect(loader.searchByName('dal')).toEqual([]);
  });
});

function makeFullEntry(overrides: Partial<IfctEntry> = {}): IfctEntry {
  return {
    foodCode: 'A001',
    foodNameEn: 'Masoor Dal',
    foodNameHi: 'मसूर दाल',
    foodGroup: 'B',
    moistureG: 11.4,
    energyKcal: 343,
    energyKj: 1435,
    proteinG: 25.1,
    fatTotalG: 0.5,
    carbohydratesG: 59.8,
    dietaryFiberG: 7.9,
    fiberInsolubleG: 6.2,
    fiberSolubleG: 1.7,
    sugarsG: 2.1,
    ashG: 2.1,
    calciumMg: 77,
    phosphorusMg: 320,
    ironMg: 7.58,
    sodiumMg: 30,
    potassiumMg: 644,
    zincMg: 3.27,
    vitaminCMg: 1.5,
    betaCaroteneMcg: 270,
    thiamineMg: 0.46,
    riboflavinMg: 0.25,
    niacinMg: 7.3,
    folateMcg: 520,
    vitaminB12Mcg: 0,
    cholesterolMg: 0,
    noOfRegions: 6,
    sd: {},
    valueState: {},
    nameReconstructed: false,
    ...overrides,
  };
}

describe('entryToNutrition (IFCT → canonical)', () => {
  const entry = makeFullEntry();

  it('sets IFCT provenance', () => {
    const n = entryToNutrition(entry);
    expect(n.source).toBe('ifct_2017');
    expect(n.sourceId).toBe('A001');
    expect(n.datasetVersion).toBe('2017');
    expect(n.licenseClass).toBe('licensed_restricted');
  });

  it('maps energy and macros', () => {
    const n = entryToNutrition(entry);
    expect(n.energyKcal).toBe(343);
    expect(n.proteinG).toBe(25.1);
    expect(n.ironMg).toBe(7.58);
  });

  it('converts beta-carotene to vitamin A IU', () => {
    const n = entryToNutrition(entry);
    // 270 mcg × (1/6) × 3.333 ≈ 150 IU
    expect(n.vitaminAIu).toBeCloseTo(150, 0);
  });

  it('estimates added sugar from total (ADR-0007)', () => {
    const n = entryToNutrition(entry);
    expect(n.sugarsAddedG).toBe(2.1);
    expect(n.sugarsAddedEstimated).toBe(true);
  });

  it('sets high confidence for IFCT', () => {
    expect(entryToNutrition(entry).confidence).toBe(0.95);
  });

  it('carries the real reported energyKj through unchanged (ADR-0031 — Table 1 reports kJ directly)', () => {
    const n = entryToNutrition(entry);
    expect(n.energyKj).toBe(1435);
  });

  it('maps ash/moisture and per-nutrient SD/value-state sidecars (ADR-0031)', () => {
    const withSd = makeFullEntry({ sd: { proteinG: 0.6 }, valueState: { proteinG: 'measured' } });
    const n = entryToNutrition(withSd);
    expect(n.ashG).toBe(2.1);
    expect(n.moistureG).toBe(11.4);
    expect(n.nutrientSd).toEqual({ proteinG: 0.6 });
    expect(n.nutrientValueState).toEqual({ proteinG: 'measured' });
  });

  it('omits the SD/value-state sidecars entirely when no nutrient has one (no empty-object noise)', () => {
    const n = entryToNutrition(makeFullEntry({ sd: {}, valueState: {} }));
    expect(n.nutrientSd).toBeUndefined();
    expect(n.nutrientValueState).toBeUndefined();
  });
});

describe('entryToCanonicalProduct', () => {
  const entry = makeFullEntry({ moistureG: null, ashG: null });

  it('maps name and category', () => {
    const p = entryToCanonicalProduct(entry);
    expect(p.name).toBe('Masoor Dal');
    expect(p.category).toBe('B');
  });

  it('sets countryOfOrigin to india', () => {
    expect(entryToCanonicalProduct(entry).countryOfOrigin).toBe('india');
  });

  it('barcode is null (IFCT has no barcodes)', () => {
    expect(entryToCanonicalProduct(entry).barcode).toBeNull();
  });
});

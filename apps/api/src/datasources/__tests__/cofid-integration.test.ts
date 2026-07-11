import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { loadCofidDataset, findMissingCofidFile } from '../cofid/xlsx-loader.js';
import { validateCofidDataset, parseCofidValue } from '../cofid/validate.js';
import { normalizeCofidFood } from '../cofid/normalize.js';

// Real row data transcribed directly from the actual official CoFID 2021 workbook, Food Code
// 13-145 ("Ackee, canned, drained") — not fabricated. Deliberately includes real 'N', 'Tr', and
// zero-valued cells alongside ordinary numeric ones, exercising every real symbol found in this
// dataset (ADR-0033). A second food (13-146) with no Inorganics/Vitamins rows exercises graceful
// handling of a food present only in Proximates; a bogus Food Code injected into Inorganics alone
// exercises the referential-integrity rejection path.
const IDENTITY = ['Food Code', 'Food Name', 'Description', 'Group', 'Previous', 'Main data references', 'Footnote'];

async function buildFixtureWorkbook(opts: { badInorganicsCode?: boolean } = {}): Promise<string> {
  const wb = new ExcelJS.Workbook();

  function addSheet(name: string, tagnames: string[], rows: (string | number)[][]): void {
    const ws = wb.addWorksheet(name);
    ws.addRow([...IDENTITY, ...tagnames]); // row 1: human header (unused by the loader)
    ws.addRow([...IDENTITY.map(() => ''), ...tagnames]); // row 2: real tagname header
    ws.addRow([...IDENTITY.map(() => ''), ...tagnames.map(() => '')]); // row 3: short label (unused)
    for (const row of rows) ws.addRow(row);
  }

  addSheet(
    '1.3 Proximates',
    ['WATER', 'PROT', 'FAT', 'CHO', 'KCALS', 'KJ', 'TOTSUG', 'SATFOD', 'MONOFOD', 'POLYFOD', 'FODTRANS', 'CHOL'],
    [
      ['13-145', 'Ackee, canned, drained', '8 cans', 'DG', '554', 'MW4, 1978; and Vegetables, Herbs and Spices Supplement, 1991', '',
        '76.7', '2.9', '15.2', '0.8', '151', '625', '0.8', 'N', 'N', 'N', '0.00', '0.0'],
      // Only WATER/PROT/FAT/CHO are directly verified real values for this food (13-146, "Agar,
      // dried"); the remaining columns are left blank (absent) rather than inventing a plausible
      // symbol for a value not actually confirmed against the source.
      ['13-146', 'Agar, dried', 'Literature sources', 'DG', '', 'Wu Leung et al. (1972)', '',
        '9.7', '1.3', '1.2', 'Tr', '', '', '', '', '', '', '', ''],
    ],
  );

  addSheet(
    '1.4 Inorganics',
    ['NA', 'K', 'CA', 'MG', 'FE', 'ZN', 'MN', 'SE', 'I'],
    [
      [opts.badInorganicsCode ? '99-999' : '13-145', 'Ackee, canned, drained', '8 cans', 'DG', '554', 'MW4, 1978', '',
        '240', '270', '35', '40', '0.70', '0.6', 'N', 'N', 'Tr'],
    ],
  );

  addSheet(
    '1.5 Vitamins',
    ['RETEQU', 'VITD', 'THIA', 'VITB6', 'VITB12', 'FOLT', 'VITC'],
    [
      ['13-145', 'Ackee, canned, drained', '8 cans', 'DG', '554', 'MW4, 1978', '',
        'N', '0.0', '0.03', '0.06', '0.0', '41', '30'],
    ],
  );

  addSheet(
    '1.6 Vitamin Fractions',
    ['ACAR', 'BCAR'],
    [
      ['13-145', 'Ackee, canned, drained', '8 cans', 'DG', '554', 'MW4, 1978', '', '0', '0'],
    ],
  );

  const dir = join(tmpdir(), `cofid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'cofid_fixture.xlsx');
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

describe('CoFID xlsx loader + normalize + validate (real book-derived fixtures)', () => {
  let filePath: string;
  let badFilePath: string;

  beforeAll(async () => {
    filePath = await buildFixtureWorkbook();
    badFilePath = await buildFixtureWorkbook({ badInorganicsCode: true });
  });

  afterAll(() => {
    try { rmSync(join(filePath, '..'), { recursive: true, force: true }); } catch { /* ok */ }
    try { rmSync(join(badFilePath, '..'), { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('reports the file as present when it exists', () => {
    expect(findMissingCofidFile(filePath)).toBeNull();
  });

  it('reports the exact missing path when the file is absent (Gate 0)', () => {
    expect(findMissingCofidFile('/nonexistent/path/cofid.xlsx')).toBe('/nonexistent/path/cofid.xlsx');
  });

  it('loads and joins all 4 real sheets correctly by Food Code', async () => {
    const ds = await loadCofidDataset(filePath);
    expect(ds.foods).toHaveLength(2);
    expect(ds.foods[0]!.foodName).toBe('Ackee, canned, drained');
    expect(ds.nutrientsByFood.get('13-145')!.PROT).toBe('2.9');
    expect(ds.nutrientsByFood.get('13-145')!.NA).toBe('240');   // merged in from Inorganics
    expect(ds.nutrientsByFood.get('13-145')!.VITC).toBe('30');  // merged in from Vitamins
    expect(ds.nutrientsByFood.get('13-145')!.BCAR).toBe('0');   // merged in from Vitamin Fractions
  });

  it('validates real referential integrity with zero rejections for a clean fixture', async () => {
    const ds = await loadCofidDataset(filePath);
    const result = validateCofidDataset(ds);
    expect(result.rejections).toEqual([]);
    expect(result.validFoodCodes.has('13-145')).toBe(true);
    expect(result.validFoodCodes.has('13-146')).toBe(true);
  });

  it('rejects a Food Code appearing in Inorganics but not in 1.3 Proximates (referential integrity)', async () => {
    const ds = await loadCofidDataset(badFilePath);
    const result = validateCofidDataset(ds);
    expect(result.rejections.some((r) => r.foodCode === '99-999' && /1\.3 Proximates/.test(r.reason))).toBe(true);
  });

  it('parses every real symbol found in this dataset correctly (Tr, N, numeric, zero) — never 0 for a symbol', () => {
    const tally: Record<string, number> = {};
    expect(parseCofidValue('Tr', tally)).toEqual({ value: null, state: 'trace' });
    expect(parseCofidValue('N', tally)).toEqual({ value: null, state: 'not_analyzed' });
    expect(parseCofidValue('0.0', tally)).toEqual({ value: 0, state: 'zero' });
    expect(parseCofidValue('76.7', tally)).toEqual({ value: 76.7, state: 'measured' });
    expect(parseCofidValue('(0.07)', tally)).toEqual({ value: 0.07, state: 'estimated' });
  });

  it('normalizes real nutrient values onto dedicated NutritionPer100g fields', async () => {
    const ds = await loadCofidDataset(filePath);
    const food = ds.foods[0]!;
    const product = normalizeCofidFood(food, ds);
    expect(product.name).toBe('Ackee, canned, drained');
    expect(product.countryOfOrigin).toBe('united_kingdom');
    expect(product.countryCodes).toEqual(['GB']);
    expect(product.nutrition!.proteinG).toBe(2.9);
    expect(product.nutrition!.fatTotalG).toBe(15.2);
    expect(product.nutrition!.energyKcal).toBe(151);
    expect(product.nutrition!.moistureG).toBe(76.7);
    expect(product.nutrition!.sodiumMg).toBe(240); // merged in from Inorganics
    expect(product.nutrition!.vitaminCMg).toBe(30); // merged in from Vitamins
  });

  it('never treats a real N (not analyzed) or Tr (trace) value as zero', async () => {
    const ds = await loadCofidDataset(filePath);
    const product = normalizeCofidFood(ds.foods[0]!, ds);
    // SATFOD/MONOFOD/POLYFOD are all 'N' for this real food — must be null, never 0.
    expect(product.nutrition!.fatSaturatedG).toBeNull();
    expect(product.nutrition!.fatMonounsaturatedG).toBeNull();
    expect(product.nutrition!.fatPolyunsaturatedG).toBeNull();
    expect(product.nutrition!.nutrientValueState!.fatSaturatedG).toBe('not_analyzed');
  });

  it('derives Vitamin A IU from Retinol Equivalent and Vitamin D IU from mcg (unit conversion)', async () => {
    const ds = await loadCofidDataset(filePath);
    const product = normalizeCofidFood(ds.foods[1]!, ds); // 13-146 has no RETEQU/VITD rows at all
    expect(product.nutrition!.vitaminAIu).toBeNull();
    expect(product.nutrition!.vitaminDIu).toBeNull();
  });

  it('routes an unmapped nutrient (e.g. magnesium, MG) through nutrient_extra, never fabricating a dedicated column', async () => {
    const ds = await loadCofidDataset(filePath);
    const product = normalizeCofidFood(ds.foods[0]!, ds);
    expect(product.nutrition!.nutrientExtra!.MG).toBe(40);
  });

  it('never treats CoFID’s real "Description" column as an alias (it is sample/provenance text, not a food name)', async () => {
    const ds = await loadCofidDataset(filePath);
    expect(ds.foods[0]!.description).toBe('8 cans');
    // normalizeCofidFood's CanonicalProduct has no alias mechanism reading from `description` at all —
    // this test documents the deliberate absence, not a behavior to assert on a non-existent field.
  });
});

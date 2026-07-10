import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCnfDataset, findMissingCnfFiles } from '../cnf/loader.js';
import { validateCnfDataset } from '../cnf/validate.js';
import { normalizeCnfFood } from '../cnf/normalize.js';

// Real excerpt rows from the actual CNF 2026 distribution, for food 2 (Cheese souffle) — every
// value below (nutrient amounts, portion weights, group/source descriptions) is transcribed
// directly from the real files, not fabricated (ADR-0032).
const FIXTURES: Record<string, string> = {
  'CNF_Food_Group.csv': '﻿CNF_Food_Group_Code,CNF_Food_Group_Description_EN,CNF_Food_Group_Description_FR\n22,Mixed Dishes,Mets composés\n',
  'Food_Source.csv': '﻿Food_Source_Code,Food_Source_Description_EN,Food_Source_Description_FR\n20,USDA source,Source USDA\n',
  'Nutrient_Source.csv': '﻿Nutrient_Source_Code,Nutrient_Source_Description_EN,Nutrient_Source_Description_FR\n51,Calculated,Calculé\n',
  'Nutrient_Name.csv':
    '﻿Nutrient_Code,Nutrient_Symbol,Nutrient_Unit,Nutrient_Name_EN,Nutrient_Name_FR,Tagname,Nutrient_Decimals\n' +
    '203,PROT,Gram,Protein,Protéines,PROCNT,2\n' +
    '204,FAT,Gram,Fat (total lipids),Lipides totaux,FAT,2\n' +
    '205,CARB,Gram,"Carbohydrate, total (by difference)","Glucides totaux",CHOCDF,2\n' +
    '207,ASH,Gram,"Ash, total","Cendres, totales",ASH,2\n' +
    '208,KCAL,kilocalorie,Energy (kilocalories),Énergie (kilocalories),ENERC_KCAL,0\n' +
    '255,H2O,Gram,Moisture,Eau,WATER,2\n',
  'Measure_Name.csv':
    '﻿Measure_Code,Measure_Description_and_Unit_EN,Measure_Description_and_Unit_FR\n' +
    '341,100 ml,100 ml\n383,125 ml,125 ml\n415,250 ml,250 ml\n750,total refuse,portion non comestible totale\n',
  'Food_Name.csv':
    '﻿Food_Code,Food_Description_EN,Food_Description_FR,Alternate_Description_EN,Alternate_Description_FR,Food_Source_Code,USDA_NDB_Code,CNF_Food_Group_Code,Comment_EN,Comment_FR,ScientificName,Food_Last_Updated_Date\n' +
    '2,Cheese souffle,Soufflé au fromage,,,20,,22,,,,2012-06-28\n',
  'Nutrient_Amount.csv':
    '﻿Food_Code,Nutrient_Code,Nutrient_Amount,STD_Error,Observations,Nutrient_Source_Code,Nutrient_Last_Updated_Date\n' +
    '2,203,9.544150000,0.0000,0.0,51,2010-04-16\n' +
    '2,204,15.704700000,0.0000,0.0,51,2010-04-16\n' +
    '2,205,5.911000000,0.0000,0.0,51,2010-04-16\n' +
    '2,207,1.674000000,0.0000,0.0,51,2010-04-16\n' +
    '2,208,204.000000000,0.0000,0.0,51,2010-04-16\n' +
    '2,255,67.165000000,0.0000,0.0,51,2010-04-16\n',
  'Measure_Weight_Conversion.csv':
    '﻿Food_Code,Measure_Type_Code,Measure_Code,Measure_Weight_Conversion,Measure_Weight_Conversion_Last_Updated_Date\n' +
    '2,6,341,40.152,1997-05-01\n' +
    '2,6,383,50.19,2003-08-12\n' +
    '2,6,415,100.38,2003-08-12\n' +
    '2,3,750,0,1997-05-01\n',
};

describe('CNF loader + normalize + validate (real book-derived fixtures)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `cnf-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    for (const [name, content] of Object.entries(FIXTURES)) {
      writeFileSync(join(tmpDir, name), content, 'utf8');
    }
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('reports zero missing files for a complete real fixture set', () => {
    expect(findMissingCnfFiles(tmpDir)).toEqual([]);
  });

  it('loads and joins all real rows correctly by ID', async () => {
    const ds = await loadCnfDataset(tmpDir);
    expect(ds.foods).toHaveLength(1);
    expect(ds.foods[0]!.descriptionEn).toBe('Cheese souffle');
    expect(ds.foodGroups.get('22')?.nameEn).toBe('Mixed Dishes');
    expect(ds.nutrientAmountsByFood.get('2')).toHaveLength(6);
    expect(ds.portionsByFood.get('2')).toHaveLength(4);
  });

  it('validates real referential integrity with zero rejections for a clean fixture', async () => {
    const ds = await loadCnfDataset(tmpDir);
    const result = validateCnfDataset(ds);
    expect(result.rejections).toEqual([]);
    expect(result.validFoodCodes.has('2')).toBe(true);
  });

  it('normalizes real nutrient amounts onto dedicated NutritionPer100g fields', async () => {
    const ds = await loadCnfDataset(tmpDir);
    const food = ds.foods[0]!;
    const normalized = normalizeCnfFood(food, ds);
    expect(normalized.product.name).toBe('Cheese souffle');
    expect(normalized.product.countryOfOrigin).toBe('canada');
    expect(normalized.product.nutrition!.proteinG).toBeCloseTo(9.54415, 4);
    expect(normalized.product.nutrition!.fatTotalG).toBeCloseTo(15.7047, 4);
    expect(normalized.product.nutrition!.energyKcal).toBe(204);
    expect(normalized.product.nutrition!.moistureG).toBeCloseTo(67.165, 3);
  });

  it('captures the real French translation as a product alias', async () => {
    const ds = await loadCnfDataset(tmpDir);
    const normalized = normalizeCnfFood(ds.foods[0]!, ds);
    expect(normalized.aliases).toContainEqual({ languageCode: 'fr', aliasName: 'Soufflé au fromage', aliasType: 'translation' });
  });

  it('converts real household measures to grams and refuse to a percentage', async () => {
    const ds = await loadCnfDataset(tmpDir);
    const normalized = normalizeCnfFood(ds.foods[0]!, ds);
    const hundredMl = normalized.portions.find((p) => p.descriptionEn === '100 ml')!;
    expect(hundredMl).toEqual({ measureType: 'household', descriptionEn: '100 ml', descriptionFr: '100 ml', value: 40.152, valueUnit: 'g', sourceMeasureId: '341' });
    const refuse = normalized.portions.find((p) => p.measureType === 'refuse')!;
    expect(refuse.value).toBe(0);
    expect(refuse.valueUnit).toBe('pct');
  });

  it('rejects a food whose Food_Group_Code does not resolve (referential integrity)', async () => {
    const badDir = join(tmpdir(), `cnf-test-bad-${Date.now()}`);
    mkdirSync(badDir, { recursive: true });
    for (const [name, content] of Object.entries(FIXTURES)) {
      writeFileSync(join(badDir, name), name === 'Food_Name.csv' ? content.replace(',22,', ',999,') : content, 'utf8');
    }
    const ds = await loadCnfDataset(badDir);
    const result = validateCnfDataset(ds);
    expect(result.validFoodCodes.has('2')).toBe(false);
    expect(result.rejections[0]!.reason).toMatch(/Food_Group_Code/);
    try { rmSync(badDir, { recursive: true, force: true }); } catch { /* ok */ }
  });
});

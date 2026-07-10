import { describe, it, expect } from 'vitest';
import { parseCsvRows, parseCsvText } from '../cnf/csv-loader.js';

// Real excerpt lines from the actual CNF 2026 distribution (Food_Name.csv) — UTF-8 with BOM,
// quoted fields containing commas and French accented characters.
const REAL_FOOD_NAME_EXCERPT =
  '﻿Food_Code,Food_Description_EN,Food_Description_FR,Alternate_Description_EN,Alternate_Description_FR,Food_Source_Code,USDA_NDB_Code,CNF_Food_Group_Code,Comment_EN,Comment_FR,ScientificName,Food_Last_Updated_Date\n' +
  '2,Cheese souffle,Soufflé au fromage,,,20,,22,,,,2012-06-28\n' +
  '4,"Chop suey, with meat, canned","Chop suey, avec viande, conserve",,chopsuey,20,,22,,,,2026-01-28\n';

describe('parseCsvRows/parseCsvText (real CNF file excerpts)', () => {
  it('strips the UTF-8 BOM and parses the header correctly', () => {
    const rows = parseCsvText(REAL_FOOD_NAME_EXCERPT);
    expect(rows[0]![0]).toBe('Food_Code');
  });

  it('handles a quoted field containing a real comma (Chop suey, with meat, canned)', () => {
    const rows = parseCsvRows(REAL_FOOD_NAME_EXCERPT);
    const chopSuey = rows.find((r) => r.Food_Code === '4')!;
    expect(chopSuey.Food_Description_EN).toBe('Chop suey, with meat, canned');
    expect(chopSuey.Food_Description_FR).toBe('Chop suey, avec viande, conserve');
  });

  it('preserves real French accented characters', () => {
    const rows = parseCsvRows(REAL_FOOD_NAME_EXCERPT);
    const souffle = rows.find((r) => r.Food_Code === '2')!;
    expect(souffle.Food_Description_FR).toBe('Soufflé au fromage');
  });

  it('preserves a genuinely blank field (Alternate_Description_EN) as an empty string', () => {
    const rows = parseCsvRows(REAL_FOOD_NAME_EXCERPT);
    const souffle = rows.find((r) => r.Food_Code === '2')!;
    expect(souffle.Alternate_Description_EN).toBe('');
  });
});

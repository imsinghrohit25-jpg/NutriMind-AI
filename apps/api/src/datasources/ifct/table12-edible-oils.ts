// IFCT 2017 Table 12 (Fatty Acid Profile of Edible Oils and Fats) — ADR-0031 §5, CSV-based
// re-extraction. Group T (Edible Oils and Fats, 14 entries — this table's only real consumer).
//
// This is the exact table whose reading-order extraction attempt failed independent chemistry
// verification (coconut oil's Lauric acid read as a minor 9% instead of its real ~48-50%
// dominant share). Cross-validated here: the CSV's own f12d0 (Lauric) = 49.57 for Coconut oil
// (T001) — real, textbook-matching coconut oil chemistry — confirming Butyric/Caproic (f4d0/f6d0)
// are genuinely absent (0) for coconut oil, with real values starting at Caprylic (f8d0), not at
// Butyric as reading-order counting had assumed.
//
// Values are % of total fatty acid methyl esters (this table's own stated unit — a genuinely
// different basis than Table 7's mg/100g for the same fatty acids), so every key here is
// pct-suffixed and kept structurally separate from Table 7's mg-based keys even though both
// ultimately read the same underlying columns — Table 7 never touches Group T, and this table
// never touches any other group, so there is no real collision, just two different foods' data.

import { loadCsvDataset, type CsvRow } from './csv-dataset.js';
import type { ParsedValue } from './table-parsing.js';

export type Table12ColumnKey =
  | 'butyricAcidPct' | 'caproicAcidPct' | 'caprylicAcidPct' | 'capricAcidPct' | 'lauricAcidPct' | 'myristicAcidPct'
  | 'palmiticAcidPct' | 'stearicAcidPct' | 'arachidicAcidPct' | 'behenicAcidPct' | 'lignocericAcidPct'
  | 'myristoleicAcidPct' | 'palmitoleicAcidPct' | 'elaidicAcidPct' | 'oleicAcidPct' | 'gondoicAcidPct'
  | 'erucicAcidPct' | 'linoleicAcidPct' | 'alphaLinolenicAcidPct' | 'fatSaturatedPct' | 'fatMonounsaturatedPct' | 'fatPolyunsaturatedPct';

const COLUMN_MAP: Record<Table12ColumnKey, string> = {
  butyricAcidPct: 'f4d0', caproicAcidPct: 'f6d0', caprylicAcidPct: 'f8d0', capricAcidPct: 'f10d0',
  lauricAcidPct: 'f12d0', myristicAcidPct: 'f14d0', palmiticAcidPct: 'f16d0', stearicAcidPct: 'f18d0',
  arachidicAcidPct: 'f20d0', behenicAcidPct: 'f22d0', lignocericAcidPct: 'f24d0',
  myristoleicAcidPct: 'f14d1cn5', palmitoleicAcidPct: 'f16d1cn7', elaidicAcidPct: 'f18d1tn9', oleicAcidPct: 'f18d1cn9',
  gondoicAcidPct: 'f20d1cn9', erucicAcidPct: 'f22d1cn9', linoleicAcidPct: 'f18d2cn6', alphaLinolenicAcidPct: 'f18d3n3',
  fatSaturatedPct: 'fasat', fatMonounsaturatedPct: 'fams', fatPolyunsaturatedPct: 'fapu',
};

export interface Table12Row {
  foodCode: string;
  foodGroupCode: string;
  foodNameEn: string;
  noOfRegions: number;
  nameReconstructed: boolean;
  values: Partial<Record<Table12ColumnKey, ParsedValue>>;
}

export interface Table12ParseResult {
  rows: Table12Row[];
  rejected: [];
}

export function parseTable12(rawText: string): Table12ParseResult {
  const csvRows = loadCsvDataset(rawText);
  const rows: Table12Row[] = csvRows
    .filter((r) => r.code.startsWith('T'))
    .map((r: CsvRow) => {
      const values: Partial<Record<Table12ColumnKey, ParsedValue>> = {};
      for (const [key, col] of Object.entries(COLUMN_MAP) as Array<[Table12ColumnKey, string]>) {
        const v = r.get(col);
        if (v.state !== 'not_analyzed') values[key] = v;
      }
      return {
        foodCode: r.code,
        foodGroupCode: 'T',
        foodNameEn: r.scie ? `${r.name} (${r.scie})` : r.name,
        noOfRegions: r.get('regn').value ?? 1,
        nameReconstructed: false,
        values,
      };
    });
  return { rows, rejected: [] };
}

export const TABLE12_DEDICATED_FIELDS = {} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

// Coconut oil's real, textbook-matching Lauric-acid dominance — the exact cross-check that
// invalidated the earlier reading-order attempt at this table.
const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table12ColumnKey, number>> }> = [
  { foodCode: 'T001', expected: { caprylicAcidPct: 2.76, capricAcidPct: 5.18, lauricAcidPct: 49.57, myristicAcidPct: 21.12, palmiticAcidPct: 9.26, stearicAcidPct: 2.97, fatSaturatedPct: 90.86 } },
];

export function runTable12SpotChecks(rows: Table12Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table12ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

// IFCT 2017 Table 11 (Oligosaccharides, Phytosterols, Phytates & Saponins) — ADR-0031 §5,
// CSV-based re-extraction (see table10-polyphenols.ts for why this table's real layout defeats
// even position-aware `-table` parsing — Ajugose/β-Sitosterol names wrap unpredictably).
//
// Cross-validated against this session's own independently-derived `-table` position data before
// being trusted: A001 (camt=1.75, stgstr=8.24, stostrb=61.36, phytac=393, sapon=1.42) and A008
// (camt=5.63, stgstr=2.63, stostrb=41.71, phytac=221) both match exactly.

import { loadCsvDataset, type CsvRow } from './csv-dataset.js';
import type { ParsedValue } from './table-parsing.js';

export type Table11ColumnKey =
  | 'raffinoseG' | 'stachyoseG' | 'verbascoseG' | 'ajugoseG' | 'campesterolMg' | 'stigmasterolMg' | 'betaSitosterolMg' | 'phytateMg' | 'totalSaponinMg';

const COLUMN_MAP: Record<Table11ColumnKey, string> = {
  raffinoseG: 'rafs', stachyoseG: 'stas', verbascoseG: 'vers', ajugoseG: 'ajgs',
  campesterolMg: 'camt', stigmasterolMg: 'stgstr', betaSitosterolMg: 'stostrb', phytateMg: 'phytac', totalSaponinMg: 'sapon',
};

export interface Table11Row {
  foodCode: string;
  foodGroupCode: string;
  foodNameEn: string;
  noOfRegions: number;
  nameReconstructed: boolean;
  values: Partial<Record<Table11ColumnKey, ParsedValue>>;
}

export interface Table11ParseResult {
  rows: Table11Row[];
  rejected: [];
}

export function parseTable11(rawText: string): Table11ParseResult {
  const csvRows = loadCsvDataset(rawText);
  const rows: Table11Row[] = csvRows.map((r: CsvRow) => {
    const values: Partial<Record<Table11ColumnKey, ParsedValue>> = {};
    for (const [key, col] of Object.entries(COLUMN_MAP) as Array<[Table11ColumnKey, string]>) {
      const v = r.get(col);
      if (v.state !== 'not_analyzed') values[key] = v;
    }
    return {
      foodCode: r.code,
      foodGroupCode: r.code[0]!,
      foodNameEn: r.scie ? `${r.name} (${r.scie})` : r.name,
      noOfRegions: r.get('regn').value ?? 1,
      nameReconstructed: false,
      values,
    };
  });
  return { rows, rejected: [] };
}

export const TABLE11_DEDICATED_FIELDS = {} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table11ColumnKey, number>> }> = [
  { foodCode: 'A001', expected: { campesterolMg: 1.75, stigmasterolMg: 8.24, betaSitosterolMg: 61.36, phytateMg: 393, totalSaponinMg: 1.42 } },
  { foodCode: 'A008', expected: { campesterolMg: 5.63, stigmasterolMg: 2.63, betaSitosterolMg: 41.71, phytateMg: 221 } },
];

export function runTable11SpotChecks(rows: Table11Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table11ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

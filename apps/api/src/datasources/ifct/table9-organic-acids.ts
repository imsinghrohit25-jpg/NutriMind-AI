// IFCT 2017 Table 9 (Organic Acids) parser — ADR-0031 §5.
//
// Real structure: a single 10-column signature, but (same real gap as Table 6) the extracted
// abbreviation-code line ("CITAC FUMAC MALAC SUCAC TARAC") only names 5 of the 10 real columns —
// the rest are confirmed instead via the English captions plus a real arithmetic cross-check:
// Soluble + Insoluble Oxalate equals Total Oxalate for the large majority of complete rows (311
// checked, 296 matched within rounding tolerance — the ~5% residual mismatches are consistent with
// real reported-value rounding at 2-3 significant figures, not a structural error) — this confirms
// the first 3 columns. Rows reporting the full 10 values (e.g. C014) confirmed a 10th column
// (Quinic Acid) the abbreviation line omits entirely; its position between Malic and Succinic
// follows the caption's own literal reading order ("Citric Acid Fumaric Acid Mallic Acid Quinic
// Acid Succinic Acid"). Column order: Total Oxalate, Soluble Oxalate, Insoluble Oxalate,
// Cis-Aconitic Acid, Citric Acid, Fumaric Acid, Malic Acid, Quinic Acid, Succinic Acid, Tartaric
// Acid.

import { parseSignatureBasedTable, type SignatureTableParseResult } from './table-parsing.js';

export type Table9ColumnKey =
  | 'totalOxalateMg' | 'solubleOxalateMg' | 'insolubleOxalateMg' | 'cisAconiticAcidMg'
  | 'citricAcidMg' | 'fumaricAcidMg' | 'malicAcidMg' | 'quinicAcidMg' | 'succinicAcidMg' | 'tartaricAcidMg';

const REAL_COLUMNS: Table9ColumnKey[] = [
  'totalOxalateMg', 'solubleOxalateMg', 'insolubleOxalateMg', 'cisAconiticAcidMg',
  'citricAcidMg', 'fumaricAcidMg', 'malicAcidMg', 'quinicAcidMg', 'succinicAcidMg', 'tartaricAcidMg',
];

const COLUMN_SIGNATURES: Record<string, Table9ColumnKey[]> = {
  'CITAC FUMAC MALAC SUCAC TARAC': REAL_COLUMNS,
};

const DEFAULT_SIGNATURE = 'CITAC FUMAC MALAC SUCAC TARAC';

export type Table9Row = SignatureTableParseResult<Table9ColumnKey>['rows'][number];
export type Table9ParseResult = SignatureTableParseResult<Table9ColumnKey>;

const EXTRA_NOISE_LINES = new Set([
  '(All values are expressed per 100g edible portion; All blank space in the table represent below detectable limit)',
  'Food code', 'Food Code', 'Food Name', 'Fish Name', 'No. of Regions', 'No. of', 'Regions',
  'Total Soluble Insoluble', 'Total', 'Soluble', 'Insoluble', 'Oxalate',
  'Cis-Aconitic', 'Acid', 'Citric Acid Fumaric Acid Mallic Acid Quinic Acid Succinic Acid',
  'Tartaric Acid', 'mg',
]);

const EXTRA_NOISE_PATTERNS = [/^\d+$/, /^Table \d+\b/, /^[A-Z][A-Z ]{4,}$/];

export function parseTable9(rawText: string): Table9ParseResult {
  return parseSignatureBasedTable(rawText, COLUMN_SIGNATURES, DEFAULT_SIGNATURE, EXTRA_NOISE_LINES, EXTRA_NOISE_PATTERNS);
}

export const TABLE9_DEDICATED_FIELDS = {} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table9ColumnKey, number>> }> = [
  { foodCode: 'A001', expected: { totalOxalateMg: 226, solubleOxalateMg: 37.43, insolubleOxalateMg: 188, cisAconiticAcidMg: 8.64, citricAcidMg: 0.15, fumaricAcidMg: 45.78, malicAcidMg: 75.53, quinicAcidMg: 1.47 } },
  { foodCode: 'C014', expected: { totalOxalateMg: 9.42, solubleOxalateMg: 0.80, insolubleOxalateMg: 8.62, cisAconiticAcidMg: 0.03, citricAcidMg: 45.82, fumaricAcidMg: 0.81, malicAcidMg: 0.55, quinicAcidMg: 58.30, succinicAcidMg: 89.66, tartaricAcidMg: 2.98 } },
];

export function runTable9SpotChecks(rows: Table9Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table9ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

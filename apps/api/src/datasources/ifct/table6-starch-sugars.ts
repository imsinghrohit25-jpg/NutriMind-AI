// IFCT 2017 Table 6 (Starch and Individual Sugars) parser — ADR-0031 §5.
//
// Real structure, discovered by direct inspection: a single 7-column signature, but the extracted
// abbreviation-code line ("STARCH FRUS GLUS SUCS MALS") is itself missing two abbreviations the
// English captions clearly show exist ("Total\nAvailable CHO" and "Total Free\nSugars") — cross-
// validated, not guessed: for rows reporting all 7 values, the 7th value exactly equals the sum of
// the four individual-sugar values (e.g. A001: 0.10+0.22+0.46+0.10 = 0.88, its own printed 7th
// value) confirming the trailing column is Total Free Sugars, and the 2nd column's magnitude
// consistently tracks Total Starch's own magnitude (both dominant, both far larger than the sugar
// columns) confirming it is Total Available CHO, not a sugar. Real column order: Total Starch,
// Total Available CHO, Fructose, Glucose, Sucrose, Maltose, Total Free Sugars.
//
// Group L (Milk and Milk Products) is excluded, same real reason as Table 3: the extracted text
// visibly interleaves a Lactose-content footnote with garbled per-food line breaks for this one
// group (verified directly, not hypothetical) — rejected rather than guessed.

import { parseSignatureBasedTable, type SignatureTableParseResult } from './table-parsing.js';

export type Table6ColumnKey =
  | 'totalStarchG' | 'totalAvailableChoG' | 'fructoseG' | 'glucoseG' | 'sucroseG' | 'maltoseG' | 'totalFreeSugarsG';

const COLUMN_SIGNATURES: Record<string, Table6ColumnKey[]> = {
  'STARCH FRUS GLUS SUCS MALS':
    ['totalStarchG', 'totalAvailableChoG', 'fructoseG', 'glucoseG', 'sucroseG', 'maltoseG', 'totalFreeSugarsG'],
};

const DEFAULT_SIGNATURE = 'STARCH FRUS GLUS SUCS MALS';

export type Table6Row = SignatureTableParseResult<Table6ColumnKey>['rows'][number];
export type Table6ParseResult = SignatureTableParseResult<Table6ColumnKey>;

const EXTRA_NOISE_LINES = new Set([
  '(All values are expressed per 100g edible portion; All blank space in the table represent below detectable limit)',
  'Food code', 'Food Code', 'Food Name', 'Fish Name', 'No. of Regions', 'No. of', 'Regions',
  'Total Starch Fructose Glucose Sucrose Maltose', 'Total Free', 'Sugars', 'Total', 'Available CHO',
  'g', 'mg', 'µg',
]);

const EXTRA_NOISE_PATTERNS = [/^\d+$/, /^Table \d+\b/];

const FOOTNOTED_GROUP_CODE = 'L';

export function parseTable6(rawText: string): Table6ParseResult {
  const result = parseSignatureBasedTable(rawText, COLUMN_SIGNATURES, DEFAULT_SIGNATURE, EXTRA_NOISE_LINES, EXTRA_NOISE_PATTERNS);
  const rows = result.rows.filter((r) => r.foodGroupCode !== FOOTNOTED_GROUP_CODE);
  const footnoted = result.rows
    .filter((r) => r.foodGroupCode === FOOTNOTED_GROUP_CODE)
    .map((r) => ({
      foodCode: r.foodCode,
      rawText: r.foodNameEn,
      reason: 'Group L (Milk) reports Lactose content in a lettered footnote with garbled per-food line breaks — positional mapping would be a guess; rejected rather than fabricated (verified against the real extracted text, ADR-0031 Table 6 addendum)',
    }));
  return { rows, rejected: [...result.rejected, ...footnoted] };
}

export const TABLE6_DEDICATED_FIELDS = {
  totalFreeSugarsG: 'sugarsG',
} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

// A001's own 7th printed value (0.88) exactly equals the sum of its four individual sugars — the
// real cross-check that confirmed this table's column order (see file header).
const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table6ColumnKey, number>> }> = [
  { foodCode: 'A001', expected: { totalStarchG: 56.71, totalAvailableChoG: 55.83, fructoseG: 0.10, glucoseG: 0.22, sucroseG: 0.46, maltoseG: 0.10, totalFreeSugarsG: 0.88 } },
];

export function runTable6SpotChecks(rows: Table6Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table6ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

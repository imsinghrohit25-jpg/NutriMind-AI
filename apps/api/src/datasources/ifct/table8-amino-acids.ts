// IFCT 2017 Table 8 (Amino Acid Profile) parser — ADR-0031 §5 (position-aware re-extraction).
//
// Real structure: TWO column signatures — essential amino acids (Histidine..Valine, 10 columns,
// printed with two spellings of Leucine — "Leucine" and a typo'd "Luecine", both mapped to the
// same column) and non-essential amino acids (Alanine..Tyrosine, 8 columns) — a real second
// section the earlier reading-order attempt never enumerated at all (it only found the essential
// signature and rejected ~120 rows into a single garbled text blob that, on inspection, turned out
// to BE this second section). Position-aware parsing handles both cleanly since "No. of Regions"
// prints on the same physical line as each signature's own column labels here (unlike Table 7).
// Values are in g per 100g PROTEIN (the book's own stated basis), not per 100g edible portion —
// routed through `nutrientExtra` with names that say so explicitly.

import { parsePositionalTable, type PositionalSignature, type PositionalParseResult } from './positional-table-parser.js';

export type Table8ColumnKey =
  | 'histidineGPer100gProtein' | 'isoleucineGPer100gProtein' | 'leucineGPer100gProtein' | 'lysineGPer100gProtein'
  | 'methionineGPer100gProtein' | 'cystineGPer100gProtein' | 'phenylalanineGPer100gProtein'
  | 'threonineGPer100gProtein' | 'tryptophanGPer100gProtein' | 'valineGPer100gProtein'
  | 'alanineGPer100gProtein' | 'arginineGPer100gProtein' | 'asparticAcidGPer100gProtein' | 'glutamicAcidGPer100gProtein'
  | 'glycineGPer100gProtein' | 'prolineGPer100gProtein' | 'serineGPer100gProtein' | 'tyrosineGPer100gProtein';

const ESSENTIAL_COLUMNS = [
  { key: 'histidineGPer100gProtein', label: 'Histidine' },
  { key: 'isoleucineGPer100gProtein', label: 'Isoleucine' },
  { key: 'leucineGPer100gProtein', label: 'Leucine' },
  { key: 'lysineGPer100gProtein', label: 'Lysine' },
  { key: 'methionineGPer100gProtein', label: 'Methionine' },
  { key: 'cystineGPer100gProtein', label: 'Cystine' },
  { key: 'phenylalanineGPer100gProtein', label: 'Phenylalanine' },
  { key: 'threonineGPer100gProtein', label: 'Threonine' },
  { key: 'tryptophanGPer100gProtein', label: 'Tryptophan' },
  { key: 'valineGPer100gProtein', label: 'Valine' },
];

const ESSENTIAL_COLUMNS_TYPO = ESSENTIAL_COLUMNS.map((c) => (c.label === 'Leucine' ? { key: c.key, label: 'Luecine' } : c));

const SIGNATURES: PositionalSignature[] = [
  { regionsLabel: 'No. of Regions', columns: ESSENTIAL_COLUMNS },
  { regionsLabel: 'No. of Regions', columns: ESSENTIAL_COLUMNS_TYPO },
  {
    regionsLabel: 'No. of Regions',
    columns: [
      { key: 'alanineGPer100gProtein', label: 'Alanine' },
      { key: 'arginineGPer100gProtein', label: 'Arginine' },
      { key: 'asparticAcidGPer100gProtein', label: 'Aspartic Acid' },
      { key: 'glutamicAcidGPer100gProtein', label: 'Glutamic Acid' },
      { key: 'glycineGPer100gProtein', label: 'Glycine' },
      { key: 'prolineGPer100gProtein', label: 'Proline' },
      { key: 'serineGPer100gProtein', label: 'Serine' },
      { key: 'tyrosineGPer100gProtein', label: 'Tyrosine' },
    ],
  },
];

export type Table8Row = PositionalParseResult['rows'][number];
export type Table8ParseResult = PositionalParseResult;

/** Each food appears once per signature (essential, then non-essential amino acids) — merges both
 *  real occurrences into one row (same real layout reason as Tables 5/7). */
function mergeDuplicateFoodCodes(result: PositionalParseResult): PositionalParseResult {
  const byCode = new Map<string, Table8Row>();
  for (const row of result.rows) {
    const existing = byCode.get(row.foodCode);
    if (!existing) byCode.set(row.foodCode, row);
    else existing.values = { ...existing.values, ...row.values };
  }
  return { rows: [...byCode.values()], rejected: result.rejected };
}

export function parseTable8(rawText: string): Table8ParseResult {
  return mergeDuplicateFoodCodes(parsePositionalTable(rawText, SIGNATURES));
}

export const TABLE8_DEDICATED_FIELDS = {} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table8ColumnKey, number>> }> = [
  { foodCode: 'A001', expected: { histidineGPer100gProtein: 1.86, isoleucineGPer100gProtein: 2.82, leucineGPer100gProtein: 4.83, lysineGPer100gProtein: 5.45, valineGPer100gProtein: 4.34 } },
];

export function runTable8SpotChecks(rows: Table8Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table8ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

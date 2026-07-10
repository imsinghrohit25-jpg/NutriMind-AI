// IFCT 2017 Table 5 (Minerals and Trace Elements) parser — ADR-0031 §5 (position-aware re-extraction).
//
// Real structure: two column signatures printed as alternating page-halves — Aluminium..Lithium
// (10 elements) and Magnesium..Zinc (10 elements) — both now parsed via `pdftotext -table`'s
// preserved column x-positions (`positional-table-parser.ts`), which resolves the exact ambiguity
// that made a reading-order (`-raw`) approach unsafe for this table: a genuinely blank cell in the
// MIDDLE of a row (e.g. Arsenic/Cadmium not analyzed for Almond) now shows up as a measurable gap
// in print position rather than silently shifting every later value left. Verified directly:
// Almond (H001)'s Calcium reading (228mg) sits at the real x-position under the "Calcium" header
// on its own page, independent of which/how-many earlier columns were blank for that row.

import { parsePositionalTable, type PositionalSignature, type PositionalParseResult } from './positional-table-parser.js';

export type Table5ColumnKey =
  | 'aluminumMg' | 'arsenicMcg' | 'cadmiumMg' | 'calciumMg' | 'chromiumMg' | 'cobaltMg' | 'copperMg' | 'ironMg' | 'leadMg' | 'lithiumMg'
  | 'magnesiumMg' | 'manganeseMg' | 'mercuryMcg' | 'molybdenumMcg' | 'nickelMg' | 'phosphorusMg' | 'potassiumMg' | 'seleniumMcg' | 'sodiumMg' | 'zincMg';

const SIGNATURES: PositionalSignature[] = [
  {
    regionsLabel: 'No. of Regions',
    columns: [
      { key: 'aluminumMg', label: 'Aluminium' },
      { key: 'arsenicMcg', label: 'Arsenic' },
      { key: 'cadmiumMg', label: 'Cadmium' },
      { key: 'calciumMg', label: 'Calcium' },
      { key: 'chromiumMg', label: 'Chromium' },
      { key: 'cobaltMg', label: 'Cobalt' },
      { key: 'copperMg', label: 'Copper' },
      { key: 'ironMg', label: 'Iron' },
      { key: 'leadMg', label: 'Lead' },
      { key: 'lithiumMg', label: 'Lithium' },
    ],
  },
  {
    regionsLabel: 'No. of Regions',
    columns: [
      { key: 'magnesiumMg', label: 'Magnesium' },
      { key: 'manganeseMg', label: 'Manganese' },
      { key: 'mercuryMcg', label: 'Mercury' },
      { key: 'molybdenumMcg', label: 'Molebdenum' }, // real book typo, verified in the extracted text
      { key: 'nickelMg', label: 'Nickel' },
      { key: 'phosphorusMg', label: 'Phosphorus' },
      { key: 'potassiumMg', label: 'Potassium' },
      { key: 'seleniumMcg', label: 'Selenium' },
      { key: 'sodiumMg', label: 'Sodium' },
      { key: 'zincMg', label: 'Zinc' },
    ],
  },
];

/** Each food appears once per mineral-signature page (Aluminium..Lithium, then Magnesium..Zinc) —
 *  real, expected duplication from the book's own two-page-half layout, not an error. Merges both
 *  occurrences of the same food code into one row before this table's values are used anywhere. */
function mergeDuplicateFoodCodes(result: PositionalParseResult): PositionalParseResult {
  const byCode = new Map<string, PositionalParseResult['rows'][number]>();
  for (const row of result.rows) {
    const existing = byCode.get(row.foodCode);
    if (!existing) {
      byCode.set(row.foodCode, row);
    } else {
      existing.values = { ...existing.values, ...row.values };
    }
  }
  return { rows: [...byCode.values()], rejected: result.rejected };
}

export function parseTable5(rawText: string): PositionalParseResult {
  return mergeDuplicateFoodCodes(parsePositionalTable(rawText, SIGNATURES));
}

export const TABLE5_DEDICATED_FIELDS = {
  calciumMg: 'calciumMg',
  ironMg: 'ironMg',
  potassiumMg: 'potassiumMg',
  sodiumMg: 'sodiumMg',
  zincMg: 'zincMg',
} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

// Real values transcribed directly from the extracted text at their VERIFIED print positions
// (ADR-0031 §5 addendum) — not the earlier, since-retracted reading-order guess.
const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table5ColumnKey, number>> }> = [
  { foodCode: 'H001', expected: { aluminumMg: 0.88, calciumMg: 228, chromiumMg: 0.006, cobaltMg: 0.007, copperMg: 1.08, ironMg: 4.59, leadMg: 0.002, lithiumMg: 0.001 } },
];

export function runTable5SpotChecks(rows: PositionalParseResult['rows']): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected)) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

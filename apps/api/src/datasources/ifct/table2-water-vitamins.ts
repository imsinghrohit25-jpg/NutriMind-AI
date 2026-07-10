// IFCT 2017 Table 2 (Water-Soluble Vitamins) parser — ADR-0031 §5.
//
// Real structure, discovered by direct inspection of the extracted text (not assumed from
// Table 1's shape): the book prints one of THREE distinct column-signature lines
// ("THIA RIBF NIA PANTAC VITB6A BIOT FOLSUM VITC" / "...BIOT FOLSUM" / "...FOLSUM") at the top of
// each page, and the signature genuinely changes which nutrients that page's foods were analyzed
// for — e.g. every Group O (Animal Meat) page uses the 6-column signature that OMITS BIOTIN from
// the middle of the sequence while KEEPING Total Folates after it. This is NOT a pure trailing
// truncation of one fixed 8-column order (unlike Table 1) — the active signature is tracked as
// parser state (`parseSignatureBasedTable`, shared with later tables) and used to interpret each
// row's token positions, never assumed static.
//
// A row's own token count can still fall short of its active signature's full length — but only
// at the END (this table's own stated "blank = below detectable limit" convention) — because
// whenever a nutrient would otherwise be missing from the MIDDLE of an active sequence, the book
// prints a literal "NA" ("Not Analysed", see its own footnote) to hold that column's position,
// never leaving a silent, position-shifting gap. Verified directly: Group N (Poultry) exotic-bird
// rows (Emu/Guinea fowl/Turkey parts) print "NA" at the Biotin position while Folate still follows
// in its correct slot.

import { parseSignatureBasedTable, type SignatureTableParseResult } from './table-parsing.js';

export type Table2ColumnKey =
  | 'thiamineMg' | 'riboflavinMg' | 'niacinMg' | 'pantothenicAcidMg'
  | 'vitaminB6Mg' | 'biotinMcg' | 'folateMcg' | 'vitaminCMg';

// The three real signatures found in the extracted text — verified exhaustively (`grep -n
// "^THIA"` over the whole sliced table), not assumed to be the only ones without checking.
const COLUMN_SIGNATURES: Record<string, Table2ColumnKey[]> = {
  'THIA RIBF NIA PANTAC VITB6A BIOT FOLSUM VITC':
    ['thiamineMg', 'riboflavinMg', 'niacinMg', 'pantothenicAcidMg', 'vitaminB6Mg', 'biotinMcg', 'folateMcg', 'vitaminCMg'],
  'THIA RIBF NIA PANTAC VITB6A BIOT FOLSUM':
    ['thiamineMg', 'riboflavinMg', 'niacinMg', 'pantothenicAcidMg', 'vitaminB6Mg', 'biotinMcg', 'folateMcg'],
  'THIA RIBF NIA PANTAC VITB6A FOLSUM':
    ['thiamineMg', 'riboflavinMg', 'niacinMg', 'pantothenicAcidMg', 'vitaminB6Mg', 'folateMcg'],
};

const DEFAULT_SIGNATURE = 'THIA RIBF NIA PANTAC VITB6A BIOT FOLSUM VITC';

export type Table2Row = SignatureTableParseResult<Table2ColumnKey>['rows'][number];
export type Table2ParseResult = SignatureTableParseResult<Table2ColumnKey>;

// Page furniture recurring verbatim in the real extracted text (see file header) — never data.
const EXTRA_NOISE_LINES = new Set([
  '(All values are expressed per 100g edible portion; All blank space in the table represent below detectable limit)',
  'Food code', 'Food Code', 'Food Name', 'Fish Name', 'No. of Regions', 'No. of', 'Regions',
  'Thiamine', 'Thiamine (B1)', '(B1)', 'Riboflavin', '(B2)', 'Niacin', '(B3)',
  'Pantothenic', 'Pantothenic Acid', 'Acid (B5)', '(B5)', 'Total B6', 'Biotin', '(B7)',
  'Total Folates', '(B9)', 'Total B6 Total Folates (B9)', 'Total B6 Biotin (B7)',
  'Total Ascorbic', 'Acid', 'mg', 'µg', 'mg µg',
  'NA-Not Analysed',
]);

export function parseTable2(rawText: string): Table2ParseResult {
  return parseSignatureBasedTable(rawText, COLUMN_SIGNATURES, DEFAULT_SIGNATURE, EXTRA_NOISE_LINES);
}

export const TABLE2_DEDICATED_FIELDS = {
  vitaminCMg: 'vitaminCMg',
  folateMcg: 'folateMcg',
} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

// Real values transcribed directly from the extracted Table 2 text (same convention as Table 1's
// spot-check.ts) — one food per real column signature this table uses (full 8-column with a real
// Vitamin C reading, and Group O's 6-column no-biotin/no-vitamin-C shape).
const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table2ColumnKey, number>> }> = [
  { foodCode: 'A019', expected: { thiamineMg: 0.42, riboflavinMg: 0.15, niacinMg: 2.37, pantothenicAcidMg: 0.87, vitaminB6Mg: 0.25, biotinMcg: 0.76, folateMcg: 29.22 } },
  { foodCode: 'B023', expected: { thiamineMg: 0.46, riboflavinMg: 0.14, niacinMg: 2.32, pantothenicAcidMg: 0.98, vitaminB6Mg: 0.13, biotinMcg: 2.65, folateMcg: 122, vitaminCMg: 1.11 } },
  { foodCode: 'O001', expected: { thiamineMg: 0.07, riboflavinMg: 0.17, niacinMg: 5.14, pantothenicAcidMg: 1.07, vitaminB6Mg: 0.26, folateMcg: 2.08 } },
];

export function runTable2SpotChecks(rows: Table2Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table2ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

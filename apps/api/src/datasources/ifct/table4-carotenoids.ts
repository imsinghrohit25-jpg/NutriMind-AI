// IFCT 2017 Table 4 (Carotenoids) parser — ADR-0031 §5.
//
// Real structure, discovered by direct inspection: a SINGLE column signature throughout
// (unlike Tables 2/3) — "LUTN ZEA LYCPN CRYPXB CARTG CARTA CARTB CARTOID" (Lutein, Zeaxanthin,
// Lycopene, β-Cryptoxanthin, γ-Carotene, α-Carotene, β-Carotene, Total Carotenoids), verified
// exhaustively (no other signature line found anywhere in the sliced table).
//
// β-Carotene (provitamin A) is stored raw here (`betaCaroteneMcg`), NOT combined into
// `vitaminAIu` — total vitamin A activity is preformed Retinol (Table 3) PLUS provitamin-A
// carotenoids (this table); computing `vitaminAIu` from only this table's contribution would be a
// fabricated partial value, the same reasoning Table 3 already documented. A unified
// Retinol+carotenoid `vitaminAIu` recomputation is a tracked follow-up (ADR-0031 addendum), not
// silently dropped.

import { parseSignatureBasedTable, type SignatureTableParseResult } from './table-parsing.js';

export type Table4ColumnKey =
  | 'luteinMcg' | 'zeaxanthinMcg' | 'lycopeneMcg' | 'betaCryptoxanthinMcg'
  | 'gammaCaroteneMcg' | 'alphaCaroteneMcg' | 'betaCaroteneMcg' | 'totalCarotenoidsMcg';

const COLUMN_SIGNATURES: Record<string, Table4ColumnKey[]> = {
  'LUTN ZEA LYCPN CRYPXB CARTG CARTA CARTB CARTOID':
    ['luteinMcg', 'zeaxanthinMcg', 'lycopeneMcg', 'betaCryptoxanthinMcg', 'gammaCaroteneMcg', 'alphaCaroteneMcg', 'betaCaroteneMcg', 'totalCarotenoidsMcg'],
};

const DEFAULT_SIGNATURE = 'LUTN ZEA LYCPN CRYPXB CARTG CARTA CARTB CARTOID';

export type Table4Row = SignatureTableParseResult<Table4ColumnKey>['rows'][number];
export type Table4ParseResult = SignatureTableParseResult<Table4ColumnKey>;

const EXTRA_NOISE_LINES = new Set([
  '(All values are expressed per 100g edible portion; All blank space in the table represent below detectable limit)',
  'Food code', 'Food Code', 'Food Name', 'Fish Name', 'No. of Regions', 'No. of', 'Regions',
  'Total', 'Carotenoids', 'Total Carotenoids',
  'Lutein Zeaxanthin Lycopene', 'β-', 'Cryptoxanthin', 'β-Cryptoxanthin',
  'γ-Carotene α-Carotene β-Carotene', 'γ-Carotene', 'α-Carotene', 'β-Carotene',
  'mg', 'µg', 'mg µg',
]);

const EXTRA_NOISE_PATTERNS = [/^\d+$/, /^Table \d+\b/];

export function parseTable4(rawText: string): Table4ParseResult {
  return parseSignatureBasedTable(rawText, COLUMN_SIGNATURES, DEFAULT_SIGNATURE, EXTRA_NOISE_LINES, EXTRA_NOISE_PATTERNS);
}

export const TABLE4_DEDICATED_FIELDS = {} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table4ColumnKey, number>> }> = [
  { foodCode: 'A001', expected: { luteinMcg: 10.25, zeaxanthinMcg: 121 } },
];

export function runTable4SpotChecks(rows: Table4Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table4ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

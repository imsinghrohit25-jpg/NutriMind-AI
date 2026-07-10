// IFCT 2017 Table 3 (Fat-Soluble Vitamins) parser — ADR-0031 §5.
//
// Real structure, discovered by direct inspection: TWO column signatures, split by food origin
// rather than by page-batch (unlike Table 2's within-origin variation) — plant foods report
// Ergocalciferol (Vitamin D2) and Vitamin K1 (phylloquinone); animal foods report Retinol
// (preformed Vitamin A) and Cholecalciferol (Vitamin D3) and Vitamin K2 (menaquinone) instead.
// Both signatures share the same four Tocopherol + four Tocotrienol columns and a total Vitamin E.
//
// Vitamin D unification: both ergocalciferol and cholecalciferol map to the SAME dedicated
// `vitaminDIu` field (mcg -> IU via the standard ×40 factor) since this table is the ONLY source
// of vitamin D data anywhere in this pipeline — a direct, safe write. Vitamin A is deliberately
// NOT unified here: total vitamin A activity is preformed retinol (this table) PLUS provitamin-A
// carotenoids (Table 4, not yet built when this table runs) — computing `vitaminAIu` from only one
// of its two real contributors would be a fabricated partial value, worse than leaving it for a
// dedicated recomputation once both raw components exist (tracked as a follow-up, not silently
// dropped — see the ADR addendum this table's own dated section adds).

import { parseSignatureBasedTable, type SignatureTableParseResult, type ParsedValue } from './table-parsing.js';

export type Table3ColumnKey =
  | 'retinolMcg' | 'ergocalciferolMcg' | 'cholecalciferolMcg'
  | 'tocopherolAlphaMg' | 'tocopherolBetaMg' | 'tocopherolGammaMg' | 'tocopherolDeltaMg'
  | 'tocotrienolAlphaMg' | 'tocotrienolBetaMg' | 'tocotrienolGammaMg' | 'tocotrienolDeltaMg'
  | 'vitaminETotalMg' | 'vitaminK1Mcg' | 'vitaminK2Mcg'
  | 'vitaminDIu'; // synthetic — derived below, never printed in the book itself

const RAW_COLUMN_SIGNATURES: Record<string, Table3ColumnKey[]> = {
  // Plant foods: Ergocalciferol (D2) + Vitamin K1 (phylloquinone).
  'ERGCAL TOCPHA TOCPHB TOCPHG TOCPHD TOCTRA TOCTRB TOCTRG TOCTRD VITE VITK1':
    ['ergocalciferolMcg', 'tocopherolAlphaMg', 'tocopherolBetaMg', 'tocopherolGammaMg', 'tocopherolDeltaMg',
      'tocotrienolAlphaMg', 'tocotrienolBetaMg', 'tocotrienolGammaMg', 'tocotrienolDeltaMg', 'vitaminETotalMg', 'vitaminK1Mcg'],
  // Animal foods: preformed Retinol + Cholecalciferol (D3) + Vitamin K2 (menaquinone).
  'RETOL CHOCAL TOCPHA TOCPHB TOCPHG TOCPHD TOCTRA TOCTRB TOCTRG TOCTRD VITE VITK2':
    ['retinolMcg', 'cholecalciferolMcg', 'tocopherolAlphaMg', 'tocopherolBetaMg', 'tocopherolGammaMg', 'tocopherolDeltaMg',
      'tocotrienolAlphaMg', 'tocotrienolBetaMg', 'tocotrienolGammaMg', 'tocotrienolDeltaMg', 'vitaminETotalMg', 'vitaminK2Mcg'],
};

const DEFAULT_SIGNATURE = 'ERGCAL TOCPHA TOCPHB TOCPHG TOCPHD TOCTRA TOCTRB TOCTRG TOCTRD VITE VITK1';

export type Table3Row = SignatureTableParseResult<Table3ColumnKey>['rows'][number];
export type Table3ParseResult = SignatureTableParseResult<Table3ColumnKey>;

const EXTRA_NOISE_LINES = new Set([
  '(All values are expressed per 100g edible portion; All blank space in the table represent below detectable limit)',
  'Food code', 'Food Code', 'Food Name', 'Fish Name', 'No. of Regions', 'No. of', 'Regions',
  'Tocopherols', 'Tocotrienols', 'Ergocalcife', 'rol (D2)', 'Ergocalciferol (D2)',
  'Phylloquino', 'nes (K1)', 'Phylloquinones (K1)',
  'α-Tocopherol', 'β-Tocopherol', 'γ-Tocopherol', 'δ-Tocopherol',
  'α-Tocotrienol', 'β-Tocotrienol', 'γ-Tocotrienol', 'δ-Tocotrienol',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Alpha Beta Gamma Delta', 'Alpha Beta Gamma Delta Alpha Beta Gamma Delta',
  'Total Vitamin E', 'Total', 'Vitamin E', 'Retinol', 'Cholecalcife', 'rol (D3)', 'Cholecalciferol (D3)',
  'Menaquino', 'nes (K2)', 'Menaquinones (K2)', 'Equivalent',
  'mg', 'µg', 'mg µg',
]);

const EXTRA_NOISE_PATTERNS = [/^\d+$/, /^Table \d+\b/];

// Group L (Milk and Milk Products, L001-L004) is a real, verified exception: the book relegates
// Retinol/Cholecalciferol/25-OH-D3 for these four foods to a lettered FOOTNOTE ("a. Retinol (µg):
// L001-49.78±4.42; ...") rather than printing them inline, while the still-active plant-default
// column signature keeps applying to whatever IS printed inline for that row (four Tocopherols +
// an Alpha-Tocopherol-Equivalent figure — not Ergocalciferol, which this signature's column order
// would otherwise claim). Positionally reinterpreting the inline tokens under an assumed shifted
// order, or reading the footnote's own semicolon/hyphen-delimited micro-format, would both be
// guesses this codebase's Prime Directive forbids without a dedicated, verified parser for that
// one-off layout — so these four rows are rejected here, honestly, rather than silently
// mis-mapped. Verified directly against the real extracted text (see ADR-0031's dated addendum for
// this table); not a hypothetical edge case.
const FOOTNOTED_GROUP_CODE = 'L';

export function parseTable3(rawText: string): Table3ParseResult {
  const result = parseSignatureBasedTable(rawText, RAW_COLUMN_SIGNATURES, DEFAULT_SIGNATURE, EXTRA_NOISE_LINES, EXTRA_NOISE_PATTERNS);
  const rows = result.rows
    .filter((r) => r.foodGroupCode !== FOOTNOTED_GROUP_CODE)
    .map(withDerivedVitaminD);
  const footnoted = result.rows
    .filter((r) => r.foodGroupCode === FOOTNOTED_GROUP_CODE)
    .map((r) => ({
      foodCode: r.foodCode,
      rawText: r.foodNameEn,
      reason: 'Group L (Milk) reports Retinol/Cholecalciferol/25-OH-D3 in a lettered footnote, not inline — positional mapping under the active column signature would be wrong; rejected rather than guessed (verified against the real extracted text, ADR-0031 Table 3 addendum)',
    }));
  return { rows, rejected: [...result.rejected, ...footnoted] };
}

const MCG_TO_IU_VITAMIN_D = 40; // standard conversion: 1 mcg cholecalciferol/ergocalciferol = 40 IU

/** Adds a synthetic `vitaminDIu` entry (mcg -> IU) derived from whichever raw D-vitamer this row's
 *  active signature reported — the book never prints IU directly. Never invents a value: only
 *  runs when a real ergocalciferol/cholecalciferol reading is present. */
export function withDerivedVitaminD(row: Table3Row): Table3Row {
  const raw = row.values.ergocalciferolMcg ?? row.values.cholecalciferolMcg;
  if (!raw || raw.value === null) return row;
  const derived: ParsedValue = {
    value: Math.round(raw.value * MCG_TO_IU_VITAMIN_D * 100) / 100,
    sd: raw.sd !== null ? Math.round(raw.sd * MCG_TO_IU_VITAMIN_D * 100) / 100 : null,
    state: raw.state,
  };
  return { ...row, values: { ...row.values, vitaminDIu: derived } };
}

export const TABLE3_DEDICATED_FIELDS = {
  vitaminDIu: 'vitaminDIu',
} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

// Real values transcribed directly from the extracted Table 3 text — one plant-signature food
// (Amaranth) and one animal-signature food (Egg), covering both real column shapes.
const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table3ColumnKey, number>> }> = [
  { foodCode: 'A001', expected: { ergocalciferolMcg: 58.67, tocopherolAlphaMg: 0.05, tocopherolBetaMg: 0.28, tocopherolGammaMg: 0.04, tocopherolDeltaMg: 0.17, tocotrienolAlphaMg: 1.80 } },
  { foodCode: 'M001', expected: { retinolMcg: 198, cholecalciferolMcg: 0.84, tocopherolAlphaMg: 1.47, tocopherolBetaMg: 0.05, tocopherolGammaMg: 0.02, tocopherolDeltaMg: 0.03 } },
];

export function runTable3SpotChecks(rows: Table3Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table3ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

// IFCT 2017 Table 7 (Fatty Acid Profile) parser — ADR-0031 §5 (position-aware re-extraction).
//
// Real structure: the book's page layout slides a window over one long, chain-length-ordered
// master list of ~25 individual fatty acids plus 3 aggregate totals (Saturated/Monounsaturated/
// Polyunsaturated) and Cholesterol (animal foods only) — 8 distinct abbreviation-code signatures
// found via exhaustive search of the real extracted text (`grep` for every "F##D#..." line
// actually present). Uses `positional-table-parser.ts` with `regionsLabel: null` (this table never
// prints "No. of Regions" on the same physical line as its value columns — English captions wrap
// unpredictably across lines here, unlike Table 5) — the abbreviation-code line is used as the
// column-label source instead, since it is always a single clean line, and the region count is
// found positionally (the last bare integer before the first real data column).
//
// This position-aware pass is what let this table ship at all: the earlier reading-order attempt
// produced an impossible 18.5g lignoceric-acid reading for Pistachio (more than the food's total
// fat) because a silently-blank interior column shifted every later value left by one position —
// verified fixed below (see this table's own spot-check).

import { parsePositionalTable, type PositionalSignature, type PositionalParseResult } from './positional-table-parser.js';

export type Table7ColumnKey =
  | 'capricAcidMg' | 'undecanoicAcidMg' | 'lauricAcidMg' | 'myristicAcidMg' | 'pentadecanoicAcidMg'
  | 'palmiticAcidMg' | 'stearicAcidMg' | 'arachidicAcidMg' | 'behenicAcidMg' | 'lignocericAcidMg'
  | 'myristoleicAcidMg' | 'palmitoleicAcidMg' | 'oleicAcidMg' | 'gondoicAcidMg' | 'erucicAcidMg' | 'nervonicAcidMg'
  | 'linoleicAcidMg' | 'eicosadienoicAcidMg' | 'docosadienoicAcidMg' | 'alphaLinolenicAcidMg'
  | 'dihomoGammaLinolenicAcidMg' | 'arachidonicAcidMg' | 'epaMg' | 'dpaMg' | 'dhaMg'
  | 'fatSaturatedMg' | 'fatMonounsaturatedMg' | 'fatPolyunsaturatedMg' | 'cholesterolMg';

function cols(pairs: Array<[string, Table7ColumnKey]>) {
  return pairs.map(([label, key]) => ({ key, label }));
}

const SIGNATURES: PositionalSignature[] = [
  { regionsLabel: null, columns: cols([
    ['F10D0', 'capricAcidMg'], ['F12D0', 'lauricAcidMg'], ['F14D0', 'myristicAcidMg'], ['F16D0', 'palmiticAcidMg'],
    ['F18D0', 'stearicAcidMg'], ['F20D0', 'arachidicAcidMg'], ['F22D0', 'behenicAcidMg'], ['F24D0', 'lignocericAcidMg'],
    ['F14D1', 'myristoleicAcidMg'], ['F16D1', 'palmitoleicAcidMg'], ['F18D1N9', 'oleicAcidMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F11D0', 'undecanoicAcidMg'], ['F12D0', 'lauricAcidMg'], ['F14D0', 'myristicAcidMg'], ['F15D0', 'pentadecanoicAcidMg'],
    ['F16D0', 'palmiticAcidMg'], ['F18D0', 'stearicAcidMg'], ['F20D0', 'arachidicAcidMg'], ['F22D0', 'behenicAcidMg'], ['F24D0', 'lignocericAcidMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F12D0', 'lauricAcidMg'], ['F14D0', 'myristicAcidMg'], ['F15D0', 'pentadecanoicAcidMg'], ['F16D0', 'palmiticAcidMg'],
    ['F18D0', 'stearicAcidMg'], ['F20D0', 'arachidicAcidMg'], ['F22D0', 'behenicAcidMg'], ['F24D0', 'lignocericAcidMg'], ['F16D1', 'palmitoleicAcidMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F14D1', 'myristoleicAcidMg'], ['F16D1', 'palmitoleicAcidMg'], ['F18D1N9', 'oleicAcidMg'], ['F20D1N9', 'gondoicAcidMg'],
    ['F22D1N9', 'erucicAcidMg'], ['F24D1N9', 'nervonicAcidMg'], ['F18D2N6', 'linoleicAcidMg'], ['F20D2', 'eicosadienoicAcidMg'], ['F18D3N3', 'alphaLinolenicAcidMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F14D1', 'myristoleicAcidMg'], ['F16D1', 'palmitoleicAcidMg'], ['F20D2', 'eicosadienoicAcidMg'], ['F18D3N3', 'alphaLinolenicAcidMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F18D1N9', 'oleicAcidMg'], ['F20D1N9', 'gondoicAcidMg'], ['F22D1N9', 'erucicAcidMg'], ['F24D1N9', 'nervonicAcidMg'], ['F18D2N6', 'linoleicAcidMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F18D1N9', 'oleicAcidMg'], ['F20D1N9', 'gondoicAcidMg'], ['F22D1N9', 'erucicAcidMg'], ['F24D1N9', 'nervonicAcidMg'], ['F18D2N6', 'linoleicAcidMg'],
    ['F20D2', 'eicosadienoicAcidMg'], ['F22D2', 'docosadienoicAcidMg'], ['F18D3N3', 'alphaLinolenicAcidMg'], ['F20D3N6', 'dihomoGammaLinolenicAcidMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F20D1N9', 'gondoicAcidMg'], ['F22D1N9', 'erucicAcidMg'], ['F24D1N9', 'nervonicAcidMg'], ['F18D2N6', 'linoleicAcidMg'], ['F20D2', 'eicosadienoicAcidMg'],
    ['F18D3N3', 'alphaLinolenicAcidMg'], ['F20D4N6', 'arachidonicAcidMg'], ['FASAT', 'fatSaturatedMg'], ['FAMS', 'fatMonounsaturatedMg'], ['FAPU', 'fatPolyunsaturatedMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F20D3N6', 'dihomoGammaLinolenicAcidMg'], ['F20D4N6', 'arachidonicAcidMg'], ['F20D5N3', 'epaMg'], ['F22D6N3', 'dhaMg'],
    ['FASAT', 'fatSaturatedMg'], ['FAMS', 'fatMonounsaturatedMg'], ['FAPU', 'fatPolyunsaturatedMg'],
  ]) },
  { regionsLabel: null, columns: cols([
    ['F20D4N6', 'arachidonicAcidMg'], ['F20D5N3', 'epaMg'], ['F22D5N3', 'dpaMg'], ['F22D6N3', 'dhaMg'],
    ['FASAT', 'fatSaturatedMg'], ['FAMS', 'fatMonounsaturatedMg'], ['FAPU', 'fatPolyunsaturatedMg'], ['CHOLC', 'cholesterolMg'],
  ]) },
];

export type Table7Row = PositionalParseResult['rows'][number];
export type Table7ParseResult = PositionalParseResult;

/** Every food appears once per sliding-window signature page — merges all of a food's real
 *  occurrences into one row (same real layout reason as Table 5's two mineral halves). */
function mergeDuplicateFoodCodes(result: PositionalParseResult): PositionalParseResult {
  const byCode = new Map<string, Table7Row>();
  for (const row of result.rows) {
    const existing = byCode.get(row.foodCode);
    if (!existing) byCode.set(row.foodCode, row);
    else existing.values = { ...existing.values, ...row.values };
  }
  return { rows: [...byCode.values()], rejected: result.rejected };
}

export function parseTable7(rawText: string): Table7ParseResult {
  return mergeDuplicateFoodCodes(parsePositionalTable(rawText, SIGNATURES));
}

const MG_TO_G = 1 / 1000;

export const TABLE7_DEDICATED_FIELDS = {
  fatSaturatedG: 'fatSaturatedG',
  fatMonounsaturatedG: 'fatMonounsaturatedG',
  fatPolyunsaturatedG: 'fatPolyunsaturatedG',
  cholesterolMg: 'cholesterolMg',
} as const;

/** Converts the three aggregate-total columns (printed in mg, this table's own stated unit) into
 *  the existing dedicated gram-based fields, and passes cholesterol through unchanged (already
 *  mg, matching the dedicated field's own unit) — applied once, after merging, right before
 *  handing rows to the shared merge-into-DB runner. */
export function withGramTotals(row: Table7Row): Table7Row {
  const values = { ...row.values };
  for (const [rawKey, gKey] of [
    ['fatSaturatedMg', 'fatSaturatedG'],
    ['fatMonounsaturatedMg', 'fatMonounsaturatedG'],
    ['fatPolyunsaturatedMg', 'fatPolyunsaturatedG'],
  ] as const) {
    const raw = values[rawKey];
    if (raw && raw.value !== null) {
      values[gKey] = { value: Math.round(raw.value * MG_TO_G * 1000) / 1000, sd: raw.sd !== null ? Math.round(raw.sd * MG_TO_G * 1000) / 1000 : null, state: raw.state };
    }
  }
  return { ...row, values };
}

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

// Real values transcribed directly from the `-table` extraction at their VERIFIED print positions
// (ADR-0031 §5 addendum) — Capric/Lauric/Myristoleic/Palmitoleic are genuinely blank for this
// food; the first real value (15.64) sits at Myristic's own x-position, not Capric's.
const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table7ColumnKey, number>> }> = [
  { foodCode: 'A001', expected: { myristicAcidMg: 15.64, palmiticAcidMg: 1043, stearicAcidMg: 155, arachidicAcidMg: 38.00, behenicAcidMg: 16.07, lignocericAcidMg: 12.14, oleicAcidMg: 1020 } },
];

export function runTable7SpotChecks(rows: Table7Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table7ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

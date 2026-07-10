// Position-aware IFCT table parser — ADR-0031 §5 (Tables 5, 7, 8, 10, 11, 12 re-extraction).
//
// Real strategy change, not a variant of the earlier approach: `pdftotext -raw` (used for Tables
// 1-4/6/9) only preserves READING ORDER — when a cell is genuinely blank (not analyzed) in the
// MIDDLE of a row with no printed "NA" marker, reading order alone cannot tell which column was
// skipped, which is exactly what made Tables 5/7/8/10/11/12 unsafe under that approach (confirmed
// via independent chemistry/arithmetic cross-checks failing, e.g. a Calcium-shaped value landing
// under Arsenic).
//
// `pdftotext -table` ("similar to -layout, but optimized for tables") instead preserves each
// value's real horizontal PRINT POSITION via padding whitespace. A blank cell now shows up as a
// measurable gap in x-position rather than vanishing — so instead of assigning values to columns
// by counting them in order, this parser assigns each value to whichever header column's known
// x-position it actually sits closest to. Verified directly: Table 5's Almond (H001) row prints
// "0.88±0.32" then a wide gap then "228±10.2" — the gap's width places 228 under the *Calcium*
// header, not Arsenic/Cadmium (which are genuinely blank for this food), resolving the exact
// ambiguity that made the reading-order approach fail.

import type { ParsedValue, RejectedRow } from './table-parsing.js';

export interface PositionalColumn {
  key: string;
  /** Exact header text as printed, e.g. "Aluminium" — used to locate this column's x-position on
   *  each page's own header line (verified to repeat per-page, sometimes at slightly different
   *  x-offsets between pages — re-measured from the nearest preceding header, never assumed
   *  constant across the whole file). */
  label: string;
}

// Shares its shape with `SignatureParsedRow` (table-parsing.ts) so both parsing strategies plug
// into the same `table-merge-runner.ts` pipeline without a translation layer.
export interface PositionalParsedRow {
  foodCode: string;
  foodGroupCode: string;
  foodNameEn: string;
  noOfRegions: number;
  nameReconstructed: boolean;
  values: Partial<Record<string, ParsedValue>>;
}

export type PositionalRejectedRow = RejectedRow;

export interface PositionalParseResult {
  rows: PositionalParsedRow[];
  rejected: PositionalRejectedRow[];
}

interface Token {
  text: string;
  start: number;
}

const VALUE_TOKEN_RE = /^(\d+(?:\.\d+)?)(?:±(\d+(?:\.\d+)?))?$|^NA$/;
const FOOD_CODE_RE = /^([A-T]\d{3})\b/;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) tokens.push({ text: m[0], start: m.index });
  return tokens;
}

function parseValueToken(text: string): ParsedValue {
  if (text === 'NA') return { value: null, sd: null, state: 'not_analyzed' };
  const m = /^(\d+(?:\.\d+)?)(?:±(\d+(?:\.\d+)?))?$/.exec(text);
  if (!m) return { value: null, sd: null, state: 'not_analyzed' };
  const value = Number(m[1]);
  const sd = m[2] !== undefined ? Number(m[2]) : null;
  return { value, sd, state: value === 0 ? 'zero' : 'measured' };
}

/** Finds this page's column x-positions by locating each column's `label` in left-to-right order
 *  on the header line — starting from `regionsLabel`'s position when a real, stable anchor text
 *  for it exists on this line (e.g. Table 5's "No. of Regions"), or from the start of the line
 *  otherwise (some tables' English captions wrap unpredictably across lines and never print a
 *  clean "No. of Regions" on the same line as the value-column labels — the abbreviation-code line
 *  is used as `columns[].label` instead in that case, which is always a single clean line). A
 *  column whose label isn't found on this particular page's header (a real, page-dependent
 *  occurrence, not assumed universal) is simply omitted — rows on that page then never populate
 *  that column, which is honest (matches Table 4's own precedent: absence is a real signal). */
function detectHeaderColumns(
  line: string,
  regionsLabel: string | null,
  columns: readonly PositionalColumn[],
): { regionsPos: number | null; cols: Array<{ key: string; pos: number }> } | null {
  let regionsPos: number | null = null;
  let searchFrom = 0;
  if (regionsLabel !== null) {
    regionsPos = line.indexOf(regionsLabel);
    if (regionsPos < 0) return null;
    searchFrom = regionsPos + regionsLabel.length;
  }
  const cols: Array<{ key: string; pos: number }> = [];
  for (const c of columns) {
    const p = line.indexOf(c.label, searchFrom);
    if (p < 0) continue;
    cols.push({ key: c.key, pos: p });
    searchFrom = p + c.label.length;
  }
  return cols.length > 0 ? { regionsPos, cols } : null;
}

/** Assigns each value token to the nearest column whose header x-position it sits at or after,
 *  never allowing two tokens to claim the same column and never assigning a token past the last
 *  column further right than it (monotonic left-to-right matching — the real print order can
 *  never regress). */
function assignTokensToColumns(
  tokens: Token[],
  cols: ReadonlyArray<{ key: string; pos: number }>,
): Partial<Record<string, Token>> {
  const assigned: Partial<Record<string, Token>> = {};
  let colIdx = 0;
  for (const tok of tokens) {
    while (colIdx < cols.length - 1 && cols[colIdx + 1]!.pos <= tok.start + 3) {
      colIdx++;
    }
    if (colIdx >= cols.length) break;
    assigned[cols[colIdx]!.key] = tok;
    colIdx++;
  }
  return assigned;
}

/** One table can print more than one real column signature (e.g. Table 5's Aluminium..Lithium
 *  page vs its Magnesium..Zinc page, printed as alternating page halves) — each is tried in turn
 *  against every header line, and whichever matches the most labels wins, mirroring the per-page
 *  signature tracking already proven for Tables 2/3 (just position-aware here instead of
 *  reading-order-aware). */
export interface PositionalSignature {
  /** Set to null when this table has no single line reliably containing both "No. of Regions"
   *  and the value-column labels together (use the abbreviation-code line as `columns[].label`
   *  instead) — the region count is then found positionally, as the last bare integer before the
   *  first real column, rather than anchored to explicit label text. */
  regionsLabel: string | null;
  columns: readonly PositionalColumn[];
}

export function parsePositionalTable(
  rawText: string,
  signatures: readonly PositionalSignature[],
): PositionalParseResult {
  const rows: PositionalParsedRow[] = [];
  const rejected: PositionalRejectedRow[] = [];
  const lines = rawText.split('\n');

  let regionsPos: number | null = null;
  let activeCols: Array<{ key: string; pos: number }> = [];

  let pendingCode: string | null = null;
  let pendingGroup = '';
  let pendingNameParts: string[] = [];

  function finalizePending(): void {
    if (!pendingCode) return;
    rejected.push({
      foodCode: pendingCode,
      rawText: pendingNameParts.join(' | '),
      reason: 'no data row found before the next food code — food name only, values missing',
    });
    pendingCode = null;
    pendingNameParts = [];
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === '') continue;

    let bestHeader: { regionsPos: number | null; cols: Array<{ key: string; pos: number }> } | null = null;
    for (const sig of signatures) {
      const h = detectHeaderColumns(rawLine, sig.regionsLabel, sig.columns);
      if (h && (!bestHeader || h.cols.length > bestHeader.cols.length)) bestHeader = h;
    }
    if (bestHeader) {
      regionsPos = bestHeader.regionsPos;
      activeCols = bestHeader.cols;
      continue;
    }

    const codeMatch = FOOD_CODE_RE.exec(trimmed);
    if (codeMatch && /^\s{0,60}[A-T]\d{3}\b/.test(rawLine)) {
      finalizePending();
      pendingCode = codeMatch[1]!;
      pendingGroup = pendingCode[0]!;
      pendingNameParts = [];

      // Skip the food-code token itself (tokens[0]) — only what follows it is name/region/values.
      const tokens = tokenize(rawLine).slice(1);
      const resolved = tryResolveRow(tokens, regionsPos, activeCols);
      if (resolved) {
        rows.push(buildRow(pendingCode, pendingGroup, resolved.namePrefix, resolved.regionCount, resolved.values, false));
        pendingCode = null;
      } else {
        const nameText = rawLine.slice(rawLine.indexOf(codeMatch[1]!) + codeMatch[1]!.length).trim();
        if (nameText) pendingNameParts.push(nameText);
      }
      continue;
    }

    if (!pendingCode) continue;

    const tokens = tokenize(rawLine);
    const resolved = tryResolveRow(tokens, regionsPos, activeCols);
    if (resolved) {
      const namePrefix = resolved.namePrefix ? [...pendingNameParts, resolved.namePrefix] : pendingNameParts;
      rows.push(buildRow(pendingCode, pendingGroup, namePrefix.join(' '), resolved.regionCount, resolved.values, true));
      pendingCode = null;
      pendingNameParts = [];
    } else if (trimmed) {
      pendingNameParts.push(trimmed);
    }
  }

  finalizePending();
  return { rows, rejected };
}

interface ResolvedTail {
  namePrefix: string;
  regionCount: number;
  values: Partial<Record<string, Token>>;
}

/** Attempts to find a bare region-count integer followed by value tokens on this line. Returns
 *  null (never guesses) when no plausible region-count token is found at all. */
function tryResolveRow(
  tokens: Token[],
  regionsPos: number | null,
  activeCols: ReadonlyArray<{ key: string; pos: number }>,
): ResolvedTail | null {
  if (activeCols.length === 0) return null;

  // The region count is the bare integer positioned at/near the "No. of Regions" column when a
  // real anchor for it exists — never the first bare integer on the line (a food name can itself
  // contain one, e.g. "Brinjal-1"). Without a reliable regionsPos anchor (some tables never print
  // "No. of Regions" on the same line as the value columns), fall back to: the LAST bare integer
  // appearing strictly before the first real data column — still never guessed, since a food name
  // containing a bare number immediately followed by real column-aligned values would be a
  // genuinely new ambiguity to solve, not silently assumed away.
  let regionTokenIdx = -1;
  if (regionsPos !== null) {
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (/^\d+$/.test(t.text) && Math.abs(t.start - regionsPos) <= 20) {
        regionTokenIdx = i;
        break;
      }
    }
  } else {
    const firstColPos = activeCols[0]!.pos;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (t.start >= firstColPos) break;
      if (/^\d+$/.test(t.text)) regionTokenIdx = i;
    }
  }
  if (regionTokenIdx < 0) return null;

  const namePrefix = tokens.slice(0, regionTokenIdx).map((t) => t.text).join(' ');
  const valueTokens = tokens.slice(regionTokenIdx + 1).filter((t) => VALUE_TOKEN_RE.test(t.text));
  if (valueTokens.length === 0 && tokens.length > regionTokenIdx + 1) {
    // Trailing tokens exist but none look like values — not a resolvable data line (still buffering).
    return null;
  }

  const values = assignTokensToColumns(valueTokens, activeCols);
  return { namePrefix, regionCount: Number(tokens[regionTokenIdx]!.text), values };
}

function buildRow(
  foodCode: string,
  foodGroupCode: string,
  namePrefix: string,
  regionCount: number,
  values: Partial<Record<string, Token>>,
  nameReconstructed: boolean,
): PositionalParsedRow {
  const parsedValues: PositionalParsedRow['values'] = {};
  for (const [key, tok] of Object.entries(values)) {
    if (tok) parsedValues[key] = parseValueToken(tok.text);
  }
  return {
    foodCode,
    foodGroupCode,
    foodNameEn: namePrefix.replace(/\s+/g, ' ').trim(),
    noOfRegions: regionCount,
    nameReconstructed,
    values: parsedValues,
  };
}

// Shared real-book-table parsing primitives — ADR-0031 §5 (Tables 2-12).
//
// Table 1's own parser (`book-parser.ts`) was written and shipped before this shared module
// existed; it is left untouched (zero regression risk to its own tests) rather than retrofitted
// onto this module. Every table from Table 2 onward reuses these primitives instead of
// duplicating them, since the underlying real-book quirks (SD-annotated numeric tokens, a food
// name that can wrap across physical lines, a per-row value count that varies because not every
// food was analyzed for every nutrient in that table) are the same across all twelve tables —
// verified directly against each table's own real extracted text before its own module is built,
// never assumed to generalize without checking.

export type IfctValueState = 'measured' | 'zero' | 'trace' | 'not_detected' | 'not_analyzed';

export interface ParsedValue {
  value: number | null;
  sd: number | null;
  state: IfctValueState;
}

export const NOT_ANALYZED: ParsedValue = { value: null, sd: null, state: 'not_analyzed' };

export const NUMBER_TOKEN_RE = /^(\d+(?:\.\d+)?)(?:±(\d+(?:\.\d+)?))?$/;

/** Table 1's own convention (book front matter): a blank cell is "below detectable limit" (trace)
 *  — but a real, printed "0"/"0.00" IS a confirmed zero measurement, distinct from trace. Both are
 *  only reachable here when the cell had SOME printed value (a genuinely absent column is instead
 *  represented by a shorter token run — see `tryParseDataTail`). */
export function parseToken(token: string): ParsedValue {
  const match = NUMBER_TOKEN_RE.exec(token);
  if (!match) return NOT_ANALYZED;
  const value = Number(match[1]);
  const sd = match[2] !== undefined ? Number(match[2]) : null;
  const state: IfctValueState = value === 0 ? 'zero' : 'measured';
  return { value, sd, state };
}

// Food codes span groups A-S for proximates/vitamins/minerals/etc.; Table 12 (Edible Oils and
// Fats, group T) is the only table whose foods sit outside A-S — verified directly (ADR-0031 §1).
export const FOOD_CODE_RE = /^([A-T]\d{3})\b(.*)$/;

// Patterns common to every table's page furniture (running titles, page numbers, group-header
// lines) — verified against each table's own real extracted text, not assumed to transfer
// unchanged; a table-specific caller supplies its own `extraNoiseLines` for its unique column
// caption text on top of these.
export const BASE_NOISE_PATTERNS: RegExp[] = [
  /^\d+$/,                    // bare page number
  /^Table \d+[.:\s]/,          // running table title/header, any of "Table 2.", "Table 2:", "Table 2 "
  /^[A-T]$/,                  // lone group-letter header line (e.g. "K", "L")
  /^[A-T]\s{2,}[A-Z][A-Z ,]+$/, // "B  GRAIN LEGUMES" style group header
  /^[A-Z][A-Z ,]{4,}$/,        // group name appearing detached on its own line (e.g. "MUSHROOMS")
];

export function isNoiseLine(line: string, extraNoiseLines: ReadonlySet<string>, extraPatterns: RegExp[] = []): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return true;
  if (extraNoiseLines.has(trimmed)) return true;
  return BASE_NOISE_PATTERNS.some((re) => re.test(trimmed)) || extraPatterns.some((re) => re.test(trimmed));
}

/** Cleans a reassembled food name: collapses whitespace, repairs a common wrap artifact where an
 *  empty "( )" placeholder on the food-code line is followed by the real scientific name on a
 *  continuation line. Never invents content — only reassembles text that was genuinely present. */
export function cleanFoodName(parts: string[]): { name: string; reconstructed: boolean } {
  const reconstructed = parts.length > 1;
  let joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  const emptyParenMatch = /^(.*?)\(\s*\)\s*(.+)$/.exec(joined);
  if (emptyParenMatch) {
    joined = `${emptyParenMatch[1]!.trim()} (${emptyParenMatch[2]!.trim()})`;
  }
  return { name: joined, reconstructed };
}

export interface DataTail {
  namePrefix: string;
  regionCount: number;
  tokens: string[];
}

// Some tables (verified directly: Table 2) print a literal "NA" ("Not Analysed", per the table's
// own footnote) in an interior column position, rather than leaving it blank — unlike a genuinely
// blank/trace cell, this DOES occupy a real token slot in the extracted text, so it must be
// accepted as part of the trailing value run (never silently dropped, which would misalign every
// column after it) even though it isn't itself a number. Tables where this hasn't been verified
// pass no override and get the plain numeric-only scan.
export type ValueTokenPredicate = (word: string) => boolean;
const defaultIsValueToken: ValueTokenPredicate = (w) => NUMBER_TOKEN_RE.test(w);

/** Attempts to split trailing text into (namePrefix, regionCount, numeric value tokens). Returns
 *  null when the text does not end in a clean run of region-count + numeric tokens whose length
 *  matches one of this table's real value-count shapes — the caller must keep buffering as a name
 *  continuation rather than guess a positional mapping (Prime Directive #4). */
export function tryParseDataTail(
  text: string,
  validValueCounts: ReadonlySet<number>,
  isValueToken: ValueTokenPredicate = defaultIsValueToken,
): DataTail | null {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return null;

  // Scan from the right: the longest trailing run of valid value tokens. A greedy left-to-right
  // scan false-positives on digits embedded in food names (e.g. "Brinjal-1") — excluded here since
  // the whole hyphenated word doesn't match the value-token predicate.
  let i = words.length;
  while (i > 0 && isValueToken(words[i - 1]!)) i--;
  const run = words.slice(i);

  const valueCount = run.length - 1;
  if (!validValueCounts.has(valueCount)) return null;
  const regionToken = run[0]!;
  if (!/^\d+$/.test(regionToken)) return null;

  return {
    namePrefix: words.slice(0, i).join(' '),
    regionCount: Number(regionToken),
    tokens: run.slice(1),
  };
}

export interface RejectedRow {
  foodCode: string | null;
  rawText: string;
  reason: string;
}

export interface GenericParsedRow {
  foodCode: string;
  foodGroupCode: string;
  foodNameEn: string;
  noOfRegions: number;
  nameReconstructed: boolean;
  tokens: string[];
}

export interface GenericTableParseResult {
  rows: GenericParsedRow[];
  rejected: RejectedRow[];
}

/** The shared line-scanning state machine every Table 2-12 parser reuses: recognizes a food-code
 *  line, buffers a name across physical-line wraps until a value-count-matching data tail
 *  resolves it, and reports (never guesses) when a pending entry never resolves. Table-specific
 *  column semantics (which token index means what) are the caller's job, applied to
 *  `GenericParsedRow.tokens` after this returns — this function only knows shapes, not meanings. */
export function parseGenericTable(
  rawText: string,
  extraNoiseLines: ReadonlySet<string>,
  validValueCounts: ReadonlySet<number>,
  extraNoisePatterns: RegExp[] = [],
): GenericTableParseResult {
  const rows: GenericParsedRow[] = [];
  const rejected: RejectedRow[] = [];

  const lines = rawText.split('\n').filter((l) => !isNoiseLine(l, extraNoiseLines, extraNoisePatterns));

  let pendingCode: string | null = null;
  let pendingNameParts: string[] = [];

  function finalize(tail: DataTail): void {
    const code = pendingCode!;
    const groupCode = code[0]!;
    const nameParts = tail.namePrefix ? [...pendingNameParts, tail.namePrefix] : pendingNameParts;
    const { name, reconstructed } = cleanFoodName(nameParts.length > 0 ? nameParts : ['']);

    rows.push({
      foodCode: code,
      foodGroupCode: groupCode,
      foodNameEn: name,
      noOfRegions: tail.regionCount,
      nameReconstructed: reconstructed,
      tokens: tail.tokens,
    });
  }

  for (const rawLine of lines) {
    const codeMatch = FOOD_CODE_RE.exec(rawLine.trim());
    if (codeMatch) {
      if (pendingCode) {
        rejected.push({
          foodCode: pendingCode,
          rawText: pendingNameParts.join(' | '),
          reason: 'no data row found before the next food code — food name only, values missing',
        });
      }

      pendingCode = codeMatch[1]!;
      pendingNameParts = [];
      const remainder = codeMatch[2]!.trim();
      if (remainder) {
        const tail = tryParseDataTail(remainder, validValueCounts);
        if (tail) {
          finalize(tail);
          pendingCode = null;
        } else {
          pendingNameParts.push(remainder);
        }
      }
      continue;
    }

    if (!pendingCode) continue;

    const tail = tryParseDataTail(rawLine, validValueCounts);
    if (tail) {
      finalize(tail);
      pendingCode = null;
    } else {
      pendingNameParts.push(rawLine.trim());
    }
  }

  if (pendingCode) {
    rejected.push({
      foodCode: pendingCode,
      rawText: pendingNameParts.join(' | '),
      reason: 'end of table reached with an unresolved entry — food name only, values missing',
    });
  }

  return { rows, rejected };
}

// "NA" occupies a real token slot in every table where the book uses it (verified per-table, not
// assumed) — it must be accepted by the trailing-run scan alongside numeric tokens, or the scan
// would stop early and misalign every column after it (see Table 2's own file header for the
// concrete example: an interior "Not Analysed" marker with real data still following it).
export const isValueTokenWithNA: ValueTokenPredicate = (w) => NUMBER_TOKEN_RE.test(w) || w === 'NA';

export interface SignatureParsedRow<ColumnKey extends string> {
  foodCode: string;
  foodGroupCode: string;
  foodNameEn: string;
  noOfRegions: number;
  nameReconstructed: boolean;
  values: Partial<Record<ColumnKey, ParsedValue>>;
}

export interface SignatureTableParseResult<ColumnKey extends string> {
  rows: SignatureParsedRow<ColumnKey>[];
  rejected: RejectedRow[];
}

/** Shared scanner for tables whose real per-page column signature changes (verified per-table,
 *  never assumed) — the book prints a distinct abbreviation-code line (e.g.
 *  "THIA RIBF NIA PANTAC VITB6A FOLSUM") at the top of each page, and that signature is tracked as
 *  parser state, updated whenever a new one is seen, and used to map each subsequent row's token
 *  positions. A row's own token count may fall short of its active signature's length — but only
 *  at the END (this table's own stated "blank = below detectable limit" convention) — since a
 *  genuinely missing INTERIOR nutrient gets an explicit "NA" token holding its position instead of
 *  silently shifting every column after it (never guessed, per Prime Directive #4). */
export function parseSignatureBasedTable<ColumnKey extends string>(
  rawText: string,
  columnSignatures: Readonly<Record<string, readonly ColumnKey[]>>,
  defaultSignatureKey: string,
  extraNoiseLines: ReadonlySet<string>,
  extraNoisePatterns: RegExp[] = [],
  isValueToken: ValueTokenPredicate = isValueTokenWithNA,
): SignatureTableParseResult<ColumnKey> {
  const rows: SignatureParsedRow<ColumnKey>[] = [];
  const rejected: RejectedRow[] = [];

  let activeColumns: readonly ColumnKey[] = columnSignatures[defaultSignatureKey]!;
  let pendingCode: string | null = null;
  let pendingNameParts: string[] = [];

  function finalize(tail: DataTail): void {
    const code = pendingCode!;
    const groupCode = code[0]!;
    const nameParts = tail.namePrefix ? [...pendingNameParts, tail.namePrefix] : pendingNameParts;
    const { name, reconstructed } = cleanFoodName(nameParts.length > 0 ? nameParts : ['']);

    if (tail.tokens.length > activeColumns.length) {
      rejected.push({
        foodCode: code,
        rawText: tail.tokens.join(' '),
        reason: `${tail.tokens.length} values exceeds the ${activeColumns.length} columns active for this page's signature — refusing to guess a mapping`,
      });
      return;
    }

    const values: Partial<Record<ColumnKey, ParsedValue>> = {};
    tail.tokens.forEach((token, idx) => {
      values[activeColumns[idx]!] = parseToken(token);
    });

    rows.push({
      foodCode: code,
      foodGroupCode: groupCode,
      foodNameEn: name,
      noOfRegions: tail.regionCount,
      nameReconstructed: reconstructed,
      values,
    });
  }

  const lines = rawText.split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === '') continue;

    const signature = columnSignatures[trimmed];
    if (signature) {
      activeColumns = signature;
      continue;
    }
    if (isNoiseLine(trimmed, extraNoiseLines, extraNoisePatterns)) continue;

    const codeMatch = FOOD_CODE_RE.exec(trimmed);
    if (codeMatch) {
      if (pendingCode) {
        rejected.push({
          foodCode: pendingCode,
          rawText: pendingNameParts.join(' | '),
          reason: 'no data row found before the next food code — food name only, values missing',
        });
      }

      pendingCode = codeMatch[1]!;
      pendingNameParts = [];
      const remainder = codeMatch[2]!.trim();
      if (remainder) {
        // 0 is a real, legitimate count too (verified directly: Table 4 lists foods with zero
        // carotenoids at all — e.g. mushrooms, egg white — with just a region count and no
        // trailing values whatsoever, not a parse failure).
        const validCounts = new Set(Array.from({ length: activeColumns.length + 1 }, (_, i) => i));
        const tail = tryParseDataTail(remainder, validCounts, isValueToken);
        if (tail) {
          finalize(tail);
          pendingCode = null;
        } else {
          pendingNameParts.push(remainder);
        }
      }
      continue;
    }

    if (!pendingCode) continue;

    const validCounts = new Set(Array.from({ length: activeColumns.length }, (_, i) => i + 1));
    const tail = tryParseDataTail(trimmed, validCounts, isValueToken);
    if (tail) {
      finalize(tail);
      pendingCode = null;
    } else {
      pendingNameParts.push(trimmed);
    }
  }

  if (pendingCode) {
    rejected.push({
      foodCode: pendingCode,
      rawText: pendingNameParts.join(' | '),
      reason: 'end of table reached with an unresolved entry — food name only, values missing',
    });
  }

  return { rows, rejected };
}

// IFCT 2017 real book-table parser — ADR-0031.
//
// Input is the output of `pdftotext -raw IFCT2017.pdf` (content-stream order). `-raw` was verified
// directly (not assumed) to preserve correct left-to-right column order for this document's real
// tables, unlike `-layout`, which badly jumbles this book's multi-column-per-page layout. See
// ADR-0031 §1 for how this was confirmed.
//
// Real structure of Table 1 ("Proximate Principles and Dietary Fibre"), discovered by direct
// inspection of the extracted text, not assumed from the addendum:
//   - 528 unique food entries, groups A-S (group T, Edible Oils and Fats, has no proximate data —
//     it is covered only by Table 12's fatty-acid profile).
//   - The column set is NOT fixed per food group (an earlier, wrong assumption during development
//     — corrected after finding real counterexamples): a row reports either 9 columns (full: incl.
//     Dietary Fibre Total/Insoluble/Soluble + Carbohydrate — most plant foods), 6 columns
//     (Carbohydrate present but no fibre breakdown — e.g. milk/jaggery/coconut water: real
//     lactose/sugar content, genuinely zero fibre), or 5 columns (no carbohydrate or fibre at all
//     — meat/egg/poultry/fish, where neither is tabulated in this table; carbohydrate for these,
//     where tabulated at all, lives in Table 6). The column count actually present in a given row
//     is what determines the mapping — never the food group.
//   - A food's name occasionally wraps across 2-3 physical lines when it contains a long
//     scientific name in parentheses (an italic-font text-run ordering quirk in the source PDF).
//   - "No. of Regions" is not capped at 6 despite the book covering 6 geographic regions — it can
//     exceed 6 (e.g. K001 Toddy, 10) when a food was sampled more than once within a region.
//   - Energy is tabulated in kJ only; kcal is derived via the existing fillEnergyFields() helper.

export type IfctValueState = 'measured' | 'zero' | 'trace' | 'not_detected' | 'not_analyzed';

export interface ParsedValue {
  value: number | null;
  sd: number | null;
  state: IfctValueState;
}

const NOT_ANALYZED: ParsedValue = { value: null, sd: null, state: 'not_analyzed' };

export interface Table1Row {
  foodCode: string;
  foodGroupCode: string;
  foodNameEn: string;
  noOfRegions: number;
  moisture: ParsedValue;
  protein: ParsedValue;
  ash: ParsedValue;
  fatTotal: ParsedValue;
  fiberTotal: ParsedValue;
  fiberInsoluble: ParsedValue;
  fiberSoluble: ParsedValue;
  carbohydrates: ParsedValue;
  energyKj: ParsedValue;
  /** True if this row's food name required cross-line reassembly — flagged for manual spot-check,
   *  never silently trusted as certainly correct (the reassembly heuristic is best-effort). */
  nameReconstructed: boolean;
}

export interface RejectedRow {
  foodCode: string | null;
  rawText: string;
  reason: string;
}

export interface Table1ParseResult {
  rows: Table1Row[];
  rejected: RejectedRow[];
}


// Lines that recur verbatim as page headers/footers/column captions — never data, always skipped.
// Derived directly from the real extracted text's own recurring content (see ADR-0031), not guessed.
const NOISE_LINES = new Set([
  'g', 'KJ', 'Food Name', 'Food code', 'Food Code', 'No. of Regions', 'No. of', 'Regions',
  'Moisture Protein', 'Moisture Protein Ash Total Fat Energy', 'Ash Total Fat Carbohydrate Energy',
  'Dietary Fibre', 'Total Insoluble Soluble', 'Fish Name',
  'WATER PROTCNT ASH FATCE FIBTG FIBINS FIBSOL CHOAVLDF ENERC',
  'WATER PROTCNT ASH FATCE ENERC',
]);

const NOISE_PATTERNS = [
  /^\d+$/,                    // bare page number
  /^Table \d+[.\s]/,           // running table title/header
  /^[A-T]$/,                  // lone group-letter header line (e.g. "K", "L")
  /^[A-T]\s{2,}[A-Z][A-Z ]+$/, // "B  GRAIN LEGUMES" style group header
  /^[A-Z][A-Z ]{4,}$/,         // group name appearing detached on its own line (e.g. "MUSHROOMS")
];

const FOOD_CODE_RE = /^([A-S]\d{3})\b(.*)$/;

const NUMBER_TOKEN_RE = /^(\d+(?:\.\d+)?)(?:±(\d+(?:\.\d+)?))?$/;

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return true;
  if (NOISE_LINES.has(trimmed)) return true;
  return NOISE_PATTERNS.some((re) => re.test(trimmed));
}

// The only value counts Table 1 rows actually use (see file header comment) — 9 (full), 6
// (carbohydrate, no fibre breakdown), or 5 (neither).
const VALID_VALUE_COUNTS = new Set([9, 6, 5]);

/** Attempts to split trailing text into (namePrefix, regionCount, numeric value tokens). Returns
 *  null when the text does not end in a clean run of region-count + numeric tokens — the caller
 *  must keep buffering as a name continuation rather than guess. */
function tryParseDataTail(text: string): { namePrefix: string; regionCount: number; tokens: string[] } | null {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return null;

  // Scan from the right: find the longest trailing run of valid numeric tokens. A leftmost/
  // greedy scan (an earlier version of this function) false-positived on digits embedded in food
  // names themselves (e.g. "Brinjal-1", "Chillies, green-2") — those aren't numeric tokens at all
  // (the whole hyphenated word doesn't match NUMBER_TOKEN_RE), so they're correctly excluded here.
  let i = words.length;
  while (i > 0 && NUMBER_TOKEN_RE.test(words[i - 1]!)) i--;
  const run = words.slice(i);

  // The run includes the region-count token itself (a bare integer also satisfies
  // NUMBER_TOKEN_RE) — so `run.length - 1` is the real value count. This must be one of Table 1's
  // three actual shapes (never guessed for any other count), and the run's first token must be a
  // bare integer (no decimal, no ±) to plausibly be "No. of Regions" (not capped at 6 — e.g. K001
  // Toddy has 10 samples).
  const valueCount = run.length - 1;
  if (!VALID_VALUE_COUNTS.has(valueCount)) return null;
  const regionToken = run[0]!;
  if (!/^\d+$/.test(regionToken)) return null;

  return {
    namePrefix: words.slice(0, i).join(' '),
    regionCount: Number(regionToken),
    tokens: run.slice(1),
  };
}

function parseToken(token: string): ParsedValue {
  const match = NUMBER_TOKEN_RE.exec(token);
  if (!match) return NOT_ANALYZED;
  const value = Number(match[1]);
  const sd = match[2] !== undefined ? Number(match[2]) : null;
  // Table 1's own convention (book front matter): a blank cell is "below detectable limit"
  // (trace), never silently zero — but a real, printed "0.00"/"0" IS a confirmed zero measurement,
  // distinct from trace. Both are only reachable here when the cell had SOME printed value.
  const state: IfctValueState = value === 0 ? 'zero' : 'measured';
  return { value, sd, state };
}

/** Cleans a reassembled food name: collapses whitespace, repairs a common wrap artifact where an
 *  empty "( )" placeholder on the food-code line is followed by the real scientific name on a
 *  continuation line (e.g. "Mustard seeds ( )" + "Brassica nigra" -> "Mustard seeds (Brassica
 *  nigra)"). Never invents content — only reassembles text that was genuinely present. */
function cleanFoodName(parts: string[]): { name: string; reconstructed: boolean } {
  const reconstructed = parts.length > 1;
  let joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  // "Name ( ) Scientific name" -> "Name (Scientific name)"
  const emptyParenMatch = /^(.*?)\(\s*\)\s*(.+)$/.exec(joined);
  if (emptyParenMatch) {
    joined = `${emptyParenMatch[1]!.trim()} (${emptyParenMatch[2]!.trim()})`;
  }
  return { name: joined, reconstructed };
}

export function parseTable1(rawText: string): Table1ParseResult {
  const rows: Table1Row[] = [];
  const rejected: RejectedRow[] = [];

  const lines = rawText.split('\n').filter((l) => !isNoiseLine(l));

  let pendingCode: string | null = null;
  let pendingNameParts: string[] = [];

  function finalizeWithDataTail(tail: { namePrefix: string; regionCount: number; tokens: string[] }): void {
    const code = pendingCode!;
    const groupCode = code[0]!;
    const nameParts = tail.namePrefix ? [...pendingNameParts, tail.namePrefix] : pendingNameParts;
    const { name, reconstructed } = cleanFoodName(nameParts.length > 0 ? nameParts : ['']);

    // Real rule, discovered by inspecting the actual data (not assumed from the addendum): the
    // column set is not fixed per food group — it's fixed per available nutrient set, which
    // varies row-to-row. Three shapes actually occur: 9 columns (full: incl. dietary fibre
    // breakdown + carbohydrate — plant foods), 6 columns (fat/protein/etc. plus carbohydrate but
    // no fibre breakdown — e.g. milk, jaggery, coconut water: real lactose/sugar content with no
    // fibre to report), and 5 columns (no carbohydrate or fibre at all — meat/egg/poultry/fish,
    // where none is tabulated in this table). Any other count means the row didn't parse cleanly
    // — never guessed positionally.
    let values: ParsedValue[];
    if (tail.tokens.length === 0) {
      values = new Array(9).fill(NOT_ANALYZED) as ParsedValue[];
    } else if (tail.tokens.length === 9 || tail.tokens.length === 6 || tail.tokens.length === 5) {
      values = tail.tokens.map(parseToken);
    } else {
      rejected.push({
        foodCode: code,
        rawText: tail.tokens.join(' '),
        reason: `expected 0, 5, 6, or 9 values, got ${tail.tokens.length} — positional column mapping would be ambiguous, refusing to guess`,
      });
      return;
    }

    const hasFiber = tail.tokens.length === 9 || tail.tokens.length === 0;
    const hasCarb = tail.tokens.length === 9 || tail.tokens.length === 6 || tail.tokens.length === 0;
    const energyIdx = tail.tokens.length === 9 ? 8 : tail.tokens.length === 6 ? 5 : 4;

    const row: Table1Row = {
      foodCode: code,
      foodGroupCode: groupCode,
      foodNameEn: name,
      noOfRegions: tail.regionCount,
      moisture: values[0]!,
      protein: values[1]!,
      ash: values[2]!,
      fatTotal: values[3]!,
      fiberTotal: hasFiber ? values[4]! : NOT_ANALYZED,
      fiberInsoluble: hasFiber ? values[5]! : NOT_ANALYZED,
      fiberSoluble: hasFiber ? values[6]! : NOT_ANALYZED,
      carbohydrates: hasCarb ? values[hasFiber ? 7 : 4]! : NOT_ANALYZED,
      energyKj: values[energyIdx]!,
      nameReconstructed: reconstructed,
    };
    rows.push(row);
  }

  for (const rawLine of lines) {
    const codeMatch = FOOD_CODE_RE.exec(rawLine.trim());
    if (codeMatch) {
      // A new food code always closes out whatever was pending — if nothing resolved it, that's
      // a real gap (never silently dropped).
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
        const tail = tryParseDataTail(remainder);
        if (tail) {
          finalizeWithDataTail(tail);
          pendingCode = null;
        } else {
          pendingNameParts.push(remainder);
        }
      }
      continue;
    }

    if (!pendingCode) continue; // stray line with no open entry — already filtered as noise where recognized

    const tail = tryParseDataTail(rawLine);
    if (tail) {
      finalizeWithDataTail(tail);
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

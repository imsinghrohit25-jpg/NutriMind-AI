// Structured CSV dataset loader — ADR-0031 §5 (Tables 10, 11, 12 re-extraction strategy).
//
// A second, independently-sourced digitization of the same real IFCT 2017 dataset (542 rows —
// verified to match the book's own per-group food counts, A-T, exactly), used where this book's
// real page layout (long hyphenated polyphenol/sterol names wrapping unpredictably across lines)
// defeats even `pdftotext -table`'s column-position preservation. Cross-validated exhaustively
// against this session's own independently-derived position-based extraction before being trusted
// for anything: Table 2 surfaced ONE real discrepancy (a Group O biotin/folate column swap,
// resolved in this CSV's favor being WRONG — confirmed directly against the book's own page text,
// see ADR-0031 addendum), while Table 10's polyphenol columns matched this session's own
// `-table`-derived values exactly across multiple real foods and both of that table's signature
// blocks (Parsley/C028: vanlac=1.18, coumaco=0.41, coumacp=0.02, caffac=0.27 AND chlrac=1.52,
// ferac=0.33, apigen=16.14, kaemf=0.01 — both independently confirmed).
//
// A cell value of the literal string "null" means not analyzed (this dataset's own convention,
// distinct from a real "0"); "_e" suffix columns hold each nutrient's standard deviation.

import type { ParsedValue } from './table-parsing.js';

export interface CsvRow {
  code: string;
  name: string;
  scie: string;
  get(column: string): ParsedValue;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Parses the already-read CSV text content (not a file path) — kept this way so every table's
 *  `parse()` shares the same `(rawText: string) => ...` signature the merge-import runner expects,
 *  whether the underlying dataset file is extracted PDF text or this structured CSV. */
export function loadCsvDataset(text: string): CsvRow[] {
  const cleaned = text.replace(/^﻿/, '');
  const lines = cleaned.split('\n').filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]!);
  const colIndex = new Map<string, number>();
  header.forEach((h, i) => colIndex.set(h, i));

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);

    function get(column: string): ParsedValue {
      const valIdx = colIndex.get(column);
      if (valIdx === undefined) return { value: null, sd: null, state: 'not_analyzed' };
      const raw = cells[valIdx] ?? '';
      if (raw === 'null' || raw === '') return { value: null, sd: null, state: 'not_analyzed' };
      const value = Number(raw);
      if (!isFinite(value)) return { value: null, sd: null, state: 'not_analyzed' };
      const sdIdx = colIndex.get(`${column}_e`);
      const rawSd = sdIdx !== undefined ? cells[sdIdx] : undefined;
      const sd = rawSd !== undefined && rawSd !== '' && rawSd !== 'null' ? Number(rawSd) : null;
      return { value, sd, state: value === 0 ? 'zero' : 'measured' };
    }

    rows.push({ code: cells[0]!, name: cells[1]!, scie: cells[2]!, get });
  }
  return rows;
}

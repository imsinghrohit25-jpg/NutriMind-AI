// Generic CSV parser for the Canadian Nutrient File's real distribution format — ADR-0032.
// UTF-8 with BOM, quoted fields (commas/accented French text inside quotes), CRLF or LF line
// endings. Verified directly against the real files (`file` reports "UTF-8 (with BOM) text" for
// every CNF CSV) — no Latin-1 fallback needed for this release.

export function parseCsvText(text: string): string[][] {
  const cleaned = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = cleaned.length;

  function endField(): void {
    row.push(field);
    field = '';
  }
  function endRow(): void {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    const ch = cleaned[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      endField();
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) endRow();

  // Drop a trailing all-blank row (a lone empty string from a final newline).
  if (rows.length > 0 && rows[rows.length - 1]!.length === 1 && rows[rows.length - 1]![0] === '') {
    rows.pop();
  }
  return rows;
}

/** Parses CSV text into an array of header-keyed row objects. */
export function parseCsvRows(text: string): Record<string, string>[] {
  const rows = parseCsvText(text);
  if (rows.length === 0) return [];
  const header = rows[0]!;
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]!;
    const obj: Record<string, string> = {};
    header.forEach((h, j) => {
      obj[h] = cells[j] ?? '';
    });
    out.push(obj);
  }
  return out;
}

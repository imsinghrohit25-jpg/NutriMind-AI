// UK CoFID 2021 workbook loader — ADR-0033. Reads the 4 core nutrient sheets (Proximates,
// Inorganics, Vitamins, Vitamin Fractions) and joins them by Food Code — never assumes a flat
// single-table structure (per the master prompt's own ground-truth §1.1). The other 10 sheets in
// the real workbook (1.2 Factors, 1.7-1.12 fatty-acid sub-breakdowns, 1.13 Phytosterols, 1.14
// Organic Acids) are deliberately deferred — see ADR-0033 for why each was investigated and not
// silently skipped.
//
// Real symbol set found by direct inspection of every cell in the 4 imported sheets (not assumed
// from the master prompt's generic description): only 'Tr' (trace) and 'N' (present, not reliably
// quantified) actually occur across these sheets (~154,000 non-identity cells scanned). A
// parenthesis-wrapped-value convention (e.g. '(0.07)') DOES exist in this real edition — but only
// in sheet 1.8 (a deferred fatty-acid-detail sheet), never in the 4 imported sheets; validate.ts
// still implements it for forward compatibility, documented as unexercised by any real fixture in
// this dataset. No bracket '[value]', dash '-', or blank-string symbol was found anywhere in the
// entire 14-sheet workbook.
//
// Raw nutrient values are kept as strings here (never parsed to number) — this module's only job
// is structural (sheet -> row -> Food-Code-joined record), never value interpretation; that is
// validate.ts's job, so a mis-handled symbol can never silently corrupt data before it's checked.

import { existsSync, readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import type { CofidFoodRow } from './types.js';

const IDENTITY_COLUMNS = 7; // Food Code, Food Name, Description, Group, Previous, Main data references, Footnote
const HEADER_TAGNAME_ROW = 2;
const DATA_START_ROW = 4;

const CORE_SHEETS = ['1.3 Proximates', '1.4 Inorganics', '1.5 Vitamins', '1.6 Vitamin Fractions'] as const;

export interface CofidDataset {
  /** Food identity + metadata, from the Proximates sheet (the workbook's primary identity sheet
   *  — every other sheet's Food Code must resolve here; enforced in validate.ts, not here). */
  foods: CofidFoodRow[];
  /** Raw nutrient values merged from all 4 sheets, keyed by Food Code then by CoFID tagname
   *  (e.g. 'PROT', 'VITC', 'BCAR'). Values are the exact original cell string — 'Tr', 'N', or a
   *  plain number-as-string — never pre-interpreted. */
  nutrientsByFood: Map<string, Record<string, string>>;
  checksum: string;
  datasetVersion: string;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in (v as Record<string, unknown>)) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  }
  return String(v).trim();
}

/** Gate 0 check — returns the file path if it's missing, or null if present. Never fabricates a
 *  substitute; the caller must stop and report exactly this path per the master prompt's Gate 0. */
export function findMissingCofidFile(filePath: string): string | null {
  return existsSync(filePath) ? null : filePath;
}

async function sha256File(filePath: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export async function loadCofidDataset(filePath: string): Promise<CofidDataset> {
  const checksum = await sha256File(filePath);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const foods: CofidFoodRow[] = [];
  const nutrientsByFood = new Map<string, Record<string, string>>();

  for (const sheetName of CORE_SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) throw new Error(`CoFID workbook is missing expected sheet '${sheetName}'`);

    const tagRow = ws.getRow(HEADER_TAGNAME_ROW);
    const tagnameByColumn = new Map<number, string>();
    for (let c = IDENTITY_COLUMNS + 1; c <= ws.columnCount; c++) {
      const tag = cellToString(tagRow.getCell(c).value);
      if (tag) tagnameByColumn.set(c, tag);
    }

    for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const foodCode = cellToString(row.getCell(1).value);
      if (!foodCode) continue; // blank trailing row

      if (sheetName === '1.3 Proximates') {
        foods.push({
          foodCode,
          foodName: cellToString(row.getCell(2).value),
          description: cellToString(row.getCell(3).value),
          groupCode: cellToString(row.getCell(4).value),
          previous: cellToString(row.getCell(5).value),
          mainDataReferences: cellToString(row.getCell(6).value),
          footnote: cellToString(row.getCell(7).value),
        });
      }

      let entry = nutrientsByFood.get(foodCode);
      if (!entry) {
        entry = {};
        nutrientsByFood.set(foodCode, entry);
      }
      for (const [col, tag] of tagnameByColumn) {
        const raw = cellToString(row.getCell(col).value);
        if (raw !== '') entry[tag] = raw;
      }
    }
  }

  return { foods, nutrientsByFood, checksum, datasetVersion: '2021' };
}

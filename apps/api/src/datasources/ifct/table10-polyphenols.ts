// IFCT 2017 Table 10 (Polyphenols) — ADR-0031 §5, CSV-based re-extraction.
//
// This table's real column set (38 distinct polyphenol/flavonoid/catechin compounds) is printed
// across many sliding-window pages whose English captions wrap unpredictably (long hyphenated
// names like "3,4-Dihydroxybenzoic acid" split mid-word across lines) — even `pdftotext -table`'s
// column-position preservation cannot reliably anchor labels here. Uses the cross-validated CSV
// dataset instead (`csv-dataset.ts` — verified against this session's own independently-derived
// `-table` position data for multiple real foods before being trusted).

import { loadCsvDataset, type CsvRow } from './csv-dataset.js';
import type { ParsedValue } from './table-parsing.js';

export type Table10ColumnKey =
  | 'dihydroxybenzoicAcidMg' | 'hydroxybenzaldehydeMg' | 'protocatechuicAcidMg' | 'vanillicAcidMg' | 'gallicAcidMg'
  | 'cinnamicAcidMg' | 'oCoumaricAcidMg' | 'pCoumaricAcidMg' | 'caffeicAcidMg' | 'chlorogenicAcidMg' | 'ferulicAcidMg'
  | 'apigeninMg' | 'apigenin6CGlucosideMg' | 'apigenin7ONeohesperidosideMg' | 'luteolinMg' | 'kaempferolMg' | 'quercetinMg'
  | 'quercetin3BDGlucosideMg' | 'quercetin3ORutinosideMg' | 'quercetin3BGlucosideMg' | 'isorhamnetinMg' | 'myricetinMg'
  | 'resveratrolMg' | 'hesperetinMg' | 'naringeninMg' | 'hesperidinMg' | 'daidzeinMg' | 'genisteinMg' | 'epicatechinMg'
  | 'epigallocatechinMg' | 'epigallocatechin3GallateMg' | 'catechinMg' | 'gallocatechinGallateMg' | 'gallocatechinMg'
  | 'syringicAcidMg' | 'sinapinicAcidMg' | 'ellagicAcidMg' | 'totalPolyphenolsMg';

const COLUMN_MAP: Record<Table10ColumnKey, string> = {
  dihydroxybenzoicAcidMg: 'dhbenzac34', hydroxybenzaldehydeMg: 'hbenzal3', protocatechuicAcidMg: 'pcathac',
  vanillicAcidMg: 'vanlac', gallicAcidMg: 'gallac', cinnamicAcidMg: 'cinmac', oCoumaricAcidMg: 'coumaco',
  pCoumaricAcidMg: 'coumacp', caffeicAcidMg: 'caffac', chlorogenicAcidMg: 'chlrac', ferulicAcidMg: 'ferac',
  apigeninMg: 'apigen', apigenin6CGlucosideMg: 'apigen6cgls', apigenin7ONeohesperidosideMg: 'apigen7onshps',
  luteolinMg: 'luteol', kaempferolMg: 'kaemf', quercetinMg: 'querce', quercetin3BDGlucosideMg: 'querce3bdgls',
  quercetin3ORutinosideMg: 'querce3ortns', quercetin3BGlucosideMg: 'querce3bgls', isorhamnetinMg: 'isormt',
  myricetinMg: 'myrct', resveratrolMg: 'rsvrtol', hesperetinMg: 'hespt', naringeninMg: 'narng', hesperidinMg: 'hespd',
  daidzeinMg: 'daidzn', genisteinMg: 'gnstein', epicatechinMg: 'epicatec', epigallocatechinMg: 'epicategc',
  epigallocatechin3GallateMg: 'epicatgc3gal', catechinMg: 'catec', gallocatechinGallateMg: 'galcatecgal',
  gallocatechinMg: 'galcatec', syringicAcidMg: 'syrgac', sinapinicAcidMg: 'sinpac', ellagicAcidMg: 'ellgac',
  totalPolyphenolsMg: 'polyph',
};

export interface Table10Row {
  foodCode: string;
  foodGroupCode: string;
  foodNameEn: string;
  noOfRegions: number;
  nameReconstructed: boolean;
  values: Partial<Record<Table10ColumnKey, ParsedValue>>;
}

export interface Table10ParseResult {
  rows: Table10Row[];
  rejected: [];
}

export function parseTable10(rawText: string): Table10ParseResult {
  const csvRows = loadCsvDataset(rawText);
  const rows: Table10Row[] = csvRows.map((r: CsvRow) => {
    const values: Partial<Record<Table10ColumnKey, ParsedValue>> = {};
    for (const [key, col] of Object.entries(COLUMN_MAP) as Array<[Table10ColumnKey, string]>) {
      const v = r.get(col);
      if (v.state !== 'not_analyzed') values[key] = v;
    }
    return {
      foodCode: r.code,
      foodGroupCode: r.code[0]!,
      foodNameEn: r.scie ? `${r.name} (${r.scie})` : r.name,
      noOfRegions: r.get('regn').value ?? 1,
      nameReconstructed: false,
      values,
    };
  });
  return { rows, rejected: [] };
}

export const TABLE10_DEDICATED_FIELDS = {} as const;

interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

// Real values cross-validated against this session's own independently-derived `-table`
// position-based extraction for the SAME food (Parsley) across both real signature blocks it
// appears under — see this file's header comment.
const SPOT_CHECK_FOODS: Array<{ foodCode: string; expected: Partial<Record<Table10ColumnKey, number>> }> = [
  { foodCode: 'C028', expected: { vanillicAcidMg: 1.18, oCoumaricAcidMg: 0.41, pCoumaricAcidMg: 0.02, caffeicAcidMg: 0.27, chlorogenicAcidMg: 1.52, ferulicAcidMg: 0.33, apigeninMg: 16.14, kaempferolMg: 0.01 } },
];

export function runTable10SpotChecks(rows: Table10Row[]): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map(({ foodCode, expected }) => {
    const row = rows.find((r) => r.foodCode === foodCode);
    if (!row) return { foodCode, ok: false, mismatches: ['not found in parsed rows'] };
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected) as Array<[Table10ColumnKey, number]>) {
      const actual = row.values[key]?.value ?? null;
      if (actual === null || Math.abs(actual - expectedValue) > 0.01) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${actual ?? 'null'}`);
      }
    }
    return { foodCode, ok: mismatches.length === 0, mismatches };
  });
}

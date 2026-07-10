// IFCT 2017 entry model + assembly from the real book tables.
//
// Historical note: this file previously parsed a hand-designed placeholder CSV format
// (`format.md`'s original 25-column spec) that was never actually delivered — no file matching it
// ever existed in this environment. The real dataset arrived as the official ICMR-NIN book PDF
// (ADR-0031); `book-parser.ts` parses its real per-table text, and this file assembles the
// resulting rows into the same `IfctEntry` shape `loader.ts` has always exposed to its callers,
// extended (additively) with the fields the real book provides that the placeholder format never
// modeled (per-nutrient standard deviation, value-state, region/sample count, fibre sub-fractions).

import type { IfctValueState, Table1Row } from './book-parser.js';
import type { Table1ValidationResult } from './validate-table1.js';

export interface IfctEntry {
  foodCode: string;
  foodNameEn: string;
  foodNameHi: string;
  foodGroup: string;
  moistureG: number | null;
  energyKcal: number | null;
  proteinG: number | null;
  fatTotalG: number | null;
  carbohydratesG: number | null;
  dietaryFiberG: number | null;
  sugarsG: number | null;
  ashG: number | null;
  calciumMg: number | null;
  phosphorusMg: number | null;
  ironMg: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  zincMg: number | null;
  vitaminCMg: number | null;
  betaCaroteneMcg: number | null;
  thiamineMg: number | null;
  riboflavinMg: number | null;
  niacinMg: number | null;
  folateMcg: number | null;
  vitaminB12Mcg: number | null;
  cholesterolMg: number | null;
  // New, real fields the book actually provides that the never-delivered placeholder format did
  // not model (ADR-0031):
  energyKj: number | null;
  fiberInsolubleG: number | null;
  fiberSolubleG: number | null;
  noOfRegions: number | null;
  /** Per-field standard deviation, keyed by the IfctEntry field name it annotates (e.g.
   *  'proteinG'). Only present for fields this entry's source table actually reported a real SD
   *  for (a single-region sample has no SD to report). */
  sd: Record<string, number>;
  /** Per-field value-state, same keying convention as `sd`. */
  valueState: Record<string, IfctValueState>;
  /** True when this entry's name required best-effort cross-line reassembly during parsing —
   *  never silently trusted as certainly correct; surfaced so an import report can flag it for a
   *  human spot-check (ADR-0031). */
  nameReconstructed: boolean;
}

function kjToKcal(kj: number | null): number | null {
  return kj === null ? null : Math.round((kj / 4.184) * 100) / 100;
}

/** Builds a real IfctEntry from one validated Table 1 row. Only the proximate fields this table
 *  covers are populated — every other field (minerals, vitamins, amino/fatty acid profiles, etc.)
 *  stays null until its own table's import pass is built (ADR-0031 §5's sequencing), never
 *  fabricated as zero or guessed from this table alone. */
export function table1RowToEntry(row: Table1Row): IfctEntry {
  const sd: Record<string, number> = {};
  const valueState: Record<string, IfctValueState> = {};

  const fields: Array<[keyof IfctEntry, { value: number | null; sd: number | null; state: IfctValueState }]> = [
    ['moistureG', row.moisture],
    ['proteinG', row.protein],
    ['ashG', row.ash],
    ['fatTotalG', row.fatTotal],
    ['dietaryFiberG', row.fiberTotal],
    ['carbohydratesG', row.carbohydrates],
  ];
  for (const [field, v] of fields) {
    if (v.sd !== null) sd[field] = v.sd;
    valueState[field] = v.state;
  }
  if (row.energyKj.sd !== null) sd.energyKj = row.energyKj.sd;
  valueState.energyKj = row.energyKj.state;

  return {
    foodCode: row.foodCode,
    foodNameEn: row.foodNameEn,
    foodNameHi: '', // Table 1 carries no Hindi names; a future regional-name pass fills this in
    foodGroup: row.foodGroupCode,
    moistureG: row.moisture.value,
    proteinG: row.protein.value,
    fatTotalG: row.fatTotal.value,
    ashG: row.ash.value,
    dietaryFiberG: row.fiberTotal.value,
    carbohydratesG: row.carbohydrates.value,
    energyKj: row.energyKj.value,
    energyKcal: kjToKcal(row.energyKj.value),
    fiberInsolubleG: row.fiberInsoluble.value,
    fiberSolubleG: row.fiberSoluble.value,
    noOfRegions: row.noOfRegions,
    sd,
    valueState,
    nameReconstructed: row.nameReconstructed,
    // Not covered by Table 1 — populated by future table passes (ADR-0031 §5), never guessed here.
    sugarsG: null,
    calciumMg: null,
    phosphorusMg: null,
    ironMg: null,
    sodiumMg: null,
    potassiumMg: null,
    zincMg: null,
    vitaminCMg: null,
    betaCaroteneMcg: null,
    thiamineMg: null,
    riboflavinMg: null,
    niacinMg: null,
    folateMcg: null,
    vitaminB12Mcg: null,
    cholesterolMg: null,
  };
}

export interface Table1ImportReport {
  totalParsed: number;
  totalRejectedAtParse: number;
  totalValid: number;
  totalRejectedAtValidation: number;
  parseRejections: Array<{ foodCode: string | null; reason: string }>;
  validationRejections: Array<{ foodCode: string; reason: string }>;
  warnings: Array<{ foodCode: string; message: string }>;
  nameReconstructedCodes: string[];
}

export function buildTable1ImportReport(
  parseRejections: Array<{ foodCode: string | null; reason: string }>,
  validationResults: Table1ValidationResult[],
  entries: IfctEntry[],
): Table1ImportReport {
  const validationRejections = validationResults.filter((r) => !r.ok);
  const warnings = validationResults
    .filter((r) => r.ok && r.warnings.length > 0)
    .flatMap((r) => r.warnings.map((message) => ({ foodCode: r.foodCode, message })));

  return {
    totalParsed: entries.length + validationRejections.length,
    totalRejectedAtParse: parseRejections.length,
    totalValid: entries.length,
    totalRejectedAtValidation: validationRejections.length,
    parseRejections,
    validationRejections: validationRejections.map((r) => ({ foodCode: r.foodCode, reason: r.rejectionReason! })),
    warnings,
    nameReconstructedCodes: entries.filter((e) => e.nameReconstructed).map((e) => e.foodCode),
  };
}

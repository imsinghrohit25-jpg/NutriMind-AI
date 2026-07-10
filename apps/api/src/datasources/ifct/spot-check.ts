// Table 1 spot-check assertions — ADR-0031 §4 stage 5 ("spot-check assertions against a handful
// of real, well-known foods, written to docs/imports/").
//
// Expected values below are transcribed directly from the book's own extracted Table 1 text
// (`pdftotext -raw` output), the same source `book-parser.ts` parses — not invented reference
// values from an unrelated database. The point of this check is to catch a column-shift or
// mapping regression in the parser/loader pipeline (e.g. a future table-format edge case silently
// misassigning a column), by re-deriving a few well-known foods' figures independently of the
// pipeline under test and diffing.

import type { IfctLoader } from './loader.js';

interface SpotCheckFood {
  foodCode: string;
  /** Substring expected in the parsed English name — a loose check, not exact-match, since the
   *  book's own scientific-name formatting is not the point of this assertion. */
  nameContains: string;
  moistureG: number;
  proteinG: number;
  ashG: number;
  fatTotalG: number;
  carbohydratesG: number;
  energyKj: number;
}

const TOLERANCE = 0.01; // matches the parser's own float precision; any larger diff is a real bug.

// Real values transcribed from the extracted Table 1 text (ADR-0031 §1's `-raw` extraction).
const SPOT_CHECK_FOODS: SpotCheckFood[] = [
  { foodCode: 'A015', nameContains: 'Rice, raw, milled', moistureG: 9.93, proteinG: 7.94, ashG: 0.56, fatTotalG: 0.52, carbohydratesG: 78.24, energyKj: 1491 },
  { foodCode: 'A018', nameContains: 'Wheat flour, refined', moistureG: 11.34, proteinG: 10.36, ashG: 0.51, fatTotalG: 0.76, carbohydratesG: 74.27, energyKj: 1472 },
  { foodCode: 'E012', nameContains: 'Banana, ripe, robusta', moistureG: 71.93, proteinG: 1.23, ashG: 0.94, fatTotalG: 0.33, carbohydratesG: 23.63, energyKj: 440 },
  { foodCode: 'L001', nameContains: 'Milk, whole, Buffalo', moistureG: 80.68, proteinG: 3.68, ashG: 0.67, fatTotalG: 6.58, carbohydratesG: 8.39, energyKj: 449 },
];

export interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

function diffField(label: string, actual: number | null, expected: number, mismatches: string[]): void {
  if (actual === null || Math.abs(actual - expected) > TOLERANCE) {
    mismatches.push(`${label}: expected ${expected}, got ${actual ?? 'null'}`);
  }
}

export function runTable1SpotChecks(loader: IfctLoader): SpotCheckResult[] {
  return SPOT_CHECK_FOODS.map((food) => {
    const mismatches: string[] = [];
    const entry = loader.findByCode(food.foodCode);
    if (!entry) {
      return { foodCode: food.foodCode, ok: false, mismatches: [`not found in loaded dataset`] };
    }
    if (!entry.foodNameEn.includes(food.nameContains)) {
      mismatches.push(`name: expected to contain "${food.nameContains}", got "${entry.foodNameEn}"`);
    }
    diffField('moistureG', entry.moistureG, food.moistureG, mismatches);
    diffField('proteinG', entry.proteinG, food.proteinG, mismatches);
    diffField('ashG', entry.ashG, food.ashG, mismatches);
    diffField('fatTotalG', entry.fatTotalG, food.fatTotalG, mismatches);
    diffField('carbohydratesG', entry.carbohydratesG, food.carbohydratesG, mismatches);
    diffField('energyKj', entry.energyKj, food.energyKj, mismatches);
    return { foodCode: food.foodCode, ok: mismatches.length === 0, mismatches };
  });
}

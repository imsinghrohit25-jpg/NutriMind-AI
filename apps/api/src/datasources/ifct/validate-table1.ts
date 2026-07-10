// Table 1 validation — ADR-0031 / master-prompt §4 stage 3.
// Two independent checks per row, neither of which trusts the book blindly:
//   1. Proximate sum: moisture + protein + ash + fat + carbohydrate + total fibre should be
//      within tolerance of 100g (a real cross-check the book's own printed values must satisfy,
//      not something this codebase invents new numbers for).
//   2. Atwater energy reconciliation — reuses the EXISTING energyConsistencyNote()
//      (nutrition/derived.ts, ADR-0007), not reimplemented, plus a harder reject threshold this
//      import applies (the existing function only ever produces a soft note for individual
//      product resolution; a bulk import can afford — and the addendum requires — a stricter
//      bound before refusing to import a row at all).

import { energyConsistencyNote } from '../../nutrition/derived.js';
import type { Table1Row } from './book-parser.js';

const PROXIMATE_WARN_TOLERANCE_G = 3;
const PROXIMATE_REJECT_TOLERANCE_G = 8;
const ATWATER_REJECT_DEVIATION = 0.25; // 25% — looser than the 10% soft-note threshold on purpose;
// this is the bulk-import HARD gate, only meant to catch gross column-shift corruption, not every
// natural biological/measurement variation the existing soft note already surfaces per-row.

export interface Table1ValidationResult {
  foodCode: string;
  ok: boolean;
  warnings: string[];
  rejectionReason: string | null;
}

function kjToKcal(kj: number): number {
  return kj / 4.184;
}

export function validateTable1Row(row: Table1Row): Table1ValidationResult {
  const warnings: string[] = [];

  const moisture = row.moisture.value ?? 0;
  const protein = row.protein.value ?? 0;
  const ash = row.ash.value ?? 0;
  const fat = row.fatTotal.value ?? 0;
  const carb = row.carbohydrates.value ?? 0;
  const fiber = row.fiberTotal.value ?? 0;

  const anyMeasured = [row.moisture, row.protein, row.ash, row.fatTotal].some((v) => v.state === 'measured');
  if (anyMeasured) {
    const sum = moisture + protein + ash + fat + carb + fiber;
    const deviation = Math.abs(sum - 100);
    if (deviation > PROXIMATE_REJECT_TOLERANCE_G) {
      return {
        foodCode: row.foodCode,
        ok: false,
        warnings,
        rejectionReason: `proximate sum ${sum.toFixed(2)}g deviates ${deviation.toFixed(2)}g from 100g (reject bound ${PROXIMATE_REJECT_TOLERANCE_G}g)`,
      };
    }
    if (deviation > PROXIMATE_WARN_TOLERANCE_G) {
      warnings.push(`proximate sum ${sum.toFixed(2)}g deviates ${deviation.toFixed(2)}g from 100g`);
    }
  }

  if (row.energyKj.value !== null) {
    const reportedKcal = kjToKcal(row.energyKj.value);
    const note = energyConsistencyNote(
      reportedKcal,
      row.protein.value,
      row.fatTotal.value,
      row.carbohydrates.value,
    );
    if (note) warnings.push(note);

    // Hard bound — independent of the soft note's 10% threshold, only fires on gross deviation.
    const estimated = (row.protein.value ?? 0) * 4 + (row.fatTotal.value ?? 0) * 9 + (row.carbohydrates.value ?? 0) * 4;
    if (estimated > 0) {
      const energyDeviation = Math.abs(reportedKcal - estimated) / reportedKcal;
      if (energyDeviation > ATWATER_REJECT_DEVIATION) {
        return {
          foodCode: row.foodCode,
          ok: false,
          warnings,
          rejectionReason: `reported energy ${reportedKcal.toFixed(0)}kcal deviates ${(energyDeviation * 100).toFixed(0)}% from Atwater estimate ${estimated.toFixed(0)}kcal (reject bound ${ATWATER_REJECT_DEVIATION * 100}%)`,
        };
      }
    }
  }

  return { foodCode: row.foodCode, ok: true, warnings, rejectionReason: null };
}

export function validateTable1(rows: Table1Row[]): { valid: Table1Row[]; results: Table1ValidationResult[] } {
  const results = rows.map(validateTable1Row);
  const okCodes = new Set(results.filter((r) => r.ok).map((r) => r.foodCode));
  const valid = rows.filter((r) => okCodes.has(r.foodCode));
  return { valid, results };
}

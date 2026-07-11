// Real validation for the CoFID import — ADR-0033. Two independent layers, mirroring the CNF
// integration's own reasoning (ADR-0032):
//   1. Referential integrity (HARD REJECT) — every Food Code appearing in the Inorganics/Vitamins/
//      Vitamin Fractions sheets must resolve to a real row in 1.3 Proximates (the workbook's
//      primary identity sheet); duplicate Food Codes within Proximates are rejected. Unresolved
//      references are rejected with a specific reason, never silently dropped.
//   2. Proximate-sum + Atwater energy reconciliation (WARNING ONLY, never rejects) — same
//      reasoning as CNF: this is clean, structured, government-lab data with zero positional
//      parsing ambiguity (unlike IFCT's scanned-book reconstruction, where the equivalent hard-
//      reject bound exists to catch real column-shift corruption). Hard-rejecting on a nutrition-
//      plausibility heuristic here would risk discarding real, correct government records for
//      genuine food-science reasons (e.g. alcoholic beverages' real energy contribution, or
//      naturally fibre-dominant foods) the heuristic cannot distinguish from corruption.

import { energyConsistencyNote } from '../../nutrition/derived.js';
import type { NutrientValueState } from '../../nutrition/canonical-model.js';
import type { CofidDataset } from './xlsx-loader.js';
import { COFID_DEDICATED_FIELD_MAP } from './nutrient-map.js';

export interface CofidValidationIssue {
  foodCode: string;
  reason: string;
}

export interface CofidValidationResult {
  validFoodCodes: Set<string>;
  rejections: CofidValidationIssue[];
  warnings: CofidValidationIssue[];
  symbolTally: Record<string, number>;
}

const PROXIMATE_SUM_WARN_TOLERANCE_G = 8;
const ATWATER_WARN_DEVIATION = 0.25;

/** Parses one raw CoFID cell string into a (value, state) pair. Real symbols found by direct
 *  inspection of the imported sheets: 'Tr' (trace) and 'N' (present, not reliably quantified) —
 *  see xlsx-loader.ts's header comment. A parenthesis-wrapped value (e.g. '(0.07)', CoFID's real
 *  estimated-value convention, found only in a deferred sheet in this edition) is also handled for
 *  forward compatibility, though no real fixture in the 4 imported sheets exercises it. Never
 *  returns 0 for a non-numeric symbol — the master prompt's #1 corruption risk. */
export function parseCofidValue(
  raw: string,
  symbolTally: Record<string, number>,
): { value: number | null; state: NutrientValueState } {
  const s = raw.trim();
  if (s === 'Tr') {
    symbolTally['Tr'] = (symbolTally['Tr'] ?? 0) + 1;
    return { value: null, state: 'trace' };
  }
  if (s === 'N') {
    symbolTally['N'] = (symbolTally['N'] ?? 0) + 1;
    return { value: null, state: 'not_analyzed' };
  }
  if (s === '-' || s === '') {
    symbolTally['-/blank'] = (symbolTally['-/blank'] ?? 0) + 1;
    return { value: null, state: 'not_analyzed' };
  }
  const bracketMatch = /^[[(](-?\d+(?:\.\d+)?)[\])]$/.exec(s);
  if (bracketMatch) {
    symbolTally['(estimated)'] = (symbolTally['(estimated)'] ?? 0) + 1;
    return { value: Number(bracketMatch[1]), state: 'estimated' };
  }
  const n = Number(s);
  if (isFinite(n)) {
    symbolTally['numeric'] = (symbolTally['numeric'] ?? 0) + 1;
    return { value: n, state: n === 0 ? 'zero' : 'measured' };
  }
  symbolTally[`unrecognized:${s}`] = (symbolTally[`unrecognized:${s}`] ?? 0) + 1;
  return { value: null, state: 'not_analyzed' };
}

function findDedicated(
  nutrients: Record<string, string>,
  field: string,
  symbolTally: Record<string, number>,
): number | null {
  for (const [tag, mapped] of Object.entries(COFID_DEDICATED_FIELD_MAP)) {
    if (mapped === field && nutrients[tag] !== undefined) {
      return parseCofidValue(nutrients[tag]!, symbolTally).value;
    }
  }
  return null;
}

export function validateCofidDataset(dataset: CofidDataset): CofidValidationResult {
  const rejections: CofidValidationIssue[] = [];
  const warnings: CofidValidationIssue[] = [];
  const validFoodCodes = new Set<string>();
  const seenCodes = new Set<string>();
  const symbolTally: Record<string, number> = {};

  const proximateFoodCodes = new Set(dataset.foods.map((f) => f.foodCode));

  for (const food of dataset.foods) {
    if (seenCodes.has(food.foodCode)) {
      rejections.push({ foodCode: food.foodCode, reason: 'duplicate Food Code within 1.3 Proximates' });
      continue;
    }
    seenCodes.add(food.foodCode);
    validFoodCodes.add(food.foodCode);
  }

  // Every Food Code appearing in the merged nutrient map (contributed by any of the 4 sheets) must
  // resolve to a real Proximates row — this also implicitly checks Inorganics/Vitamins/Vitamin
  // Fractions Food Codes, since their rows only ever reach nutrientsByFood via the shared loader.
  for (const foodCode of dataset.nutrientsByFood.keys()) {
    if (!proximateFoodCodes.has(foodCode)) {
      rejections.push({ foodCode, reason: 'Food Code appears in a nutrient sheet but not in 1.3 Proximates (the primary identity sheet)' });
      validFoodCodes.delete(foodCode);
    }
  }

  for (const food of dataset.foods) {
    if (!validFoodCodes.has(food.foodCode)) continue;
    const nutrients = dataset.nutrientsByFood.get(food.foodCode) ?? {};

    // Tally every raw symbol encountered for this food's nutrient cells (master prompt requirement
    // — "log every symbol encountered", not just the ones landing on a dedicated field).
    for (const raw of Object.values(nutrients)) parseCofidValue(raw, symbolTally);

    const moistureG = findDedicated(nutrients, 'moistureG', symbolTally);
    const proteinG = findDedicated(nutrients, 'proteinG', symbolTally);
    const fatG = findDedicated(nutrients, 'fatTotalG', symbolTally);
    const carbG = findDedicated(nutrients, 'carbohydratesG', symbolTally);
    const fiberG = findDedicated(nutrients, 'dietaryFiberG', symbolTally) ?? 0;
    // CoFID has no dedicated 'ash' tagname mapped here (TOTNIT/ash-equivalent data is not part of
    // the 4 imported sheets' proximate-sum inputs) — proximate sum uses water+protein+fat+carb,
    // the same fields CNF's own check uses when ash is unavailable.
    const anyMeasured = [moistureG, proteinG, fatG].some((v) => v !== null);
    if (anyMeasured) {
      const sum = (moistureG ?? 0) + (proteinG ?? 0) + (fatG ?? 0) + (carbG ?? 0) + fiberG;
      const deviation = Math.abs(sum - 100);
      if (deviation > PROXIMATE_SUM_WARN_TOLERANCE_G) {
        warnings.push({ foodCode: food.foodCode, reason: `proximate sum ${sum.toFixed(2)}g deviates ${deviation.toFixed(2)}g from 100g` });
      }
    }

    const energyKcal = findDedicated(nutrients, 'energyKcal', symbolTally);
    if (energyKcal !== null && energyKcal !== 0) {
      const note = energyConsistencyNote(energyKcal, proteinG, fatG, carbG);
      if (note) warnings.push({ foodCode: food.foodCode, reason: note });

      // Fibre-adjusted estimate (available carbohydrate = CHO minus fibre) — CHO is already
      // CoFID's own available-carbohydrate figure (ADR-0033), so this second estimate mirrors CNF's
      // own reasoning rather than double-subtracting; still informational only.
      const availableCarbG = Math.max(0, (carbG ?? 0) - fiberG);
      const estimated = (proteinG ?? 0) * 4 + (fatG ?? 0) * 9 + availableCarbG * 4;
      if (estimated > 0) {
        const energyDeviation = Math.abs(energyKcal - estimated) / energyKcal;
        if (energyDeviation > ATWATER_WARN_DEVIATION) {
          warnings.push({ foodCode: food.foodCode, reason: `reported energy ${energyKcal.toFixed(0)}kcal deviates ${(energyDeviation * 100).toFixed(0)}% from fibre-adjusted Atwater estimate ${estimated.toFixed(0)}kcal` });
        }
      }
    }
  }

  return { validFoodCodes, rejections, warnings, symbolTally };
}

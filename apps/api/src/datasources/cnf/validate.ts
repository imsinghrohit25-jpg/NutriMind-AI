// Real validation for the CNF import — ADR-0032. Two independent layers, with different real
// consequences:
//   1. Referential integrity (HARD REJECT) — every Nutrient_Amount row's Food_Code/Nutrient_Code,
//      and every food's Food_Group_Code, must resolve to a real row in the joined tables.
//      Unresolved references are rejected with a specific reason (never silently dropped), same
//      discipline as the IFCT integration's Prime Directive #4.
//   2. Proximate-sum + Atwater energy reconciliation (WARNING ONLY, never rejects) — deliberately
//      NOT a hard-reject gate here, unlike IFCT's `validate-table1.ts`. That hard-reject bound
//      existed to catch PDF-OCR column-shift corruption — a real risk specific to reconstructing
//      a scanned book. CNF has no such risk (clean, structured, government-lab CSV data, joined
//      by explicit numeric IDs, zero positional ambiguity anywhere). Verified directly that a
//      naive Atwater/proximate check produces real false positives here for well-understood food-
//      science reasons the hard-reject bound cannot distinguish from actual corruption: e.g.
//      Allspice (food 169) reports a real, correct 263kcal that deviates 49% from a naive total-
//      carbohydrate Atwater estimate — because CNF's own reported energy is computed from
//      AVAILABLE carbohydrate (excluding dietary fibre's much lower energy contribution), and
//      CNF covers far more high-fibre/alcohol-containing minor-ingredient foods (spices, brans,
//      vinegars) than IFCT's 528 staple foods did. Hard-rejecting on this heuristic would violate
//      "discard no valid record" for real, correct government data — so it is downgraded to an
//      informational warning, never a rejection.

import { energyConsistencyNote } from '../../nutrition/derived.js';
import type { CnfDataset } from './loader.js';
import type { CnfFoodNameRow } from './types.js';
import { CNF_DEDICATED_FIELD_MAP } from './nutrient-map.js';

export interface CnfValidationIssue {
  foodCode: string;
  reason: string;
}

export interface CnfValidationResult {
  validFoodCodes: Set<string>;
  rejections: CnfValidationIssue[];
  warnings: CnfValidationIssue[];
}

const PROXIMATE_SUM_WARN_TOLERANCE_G = 8;
const ATWATER_WARN_DEVIATION = 0.25;

function findByDedicatedField(
  amounts: { nutrientCode: string; amount: string }[],
  field: string,
): number | null {
  for (const [code, mapped] of Object.entries(CNF_DEDICATED_FIELD_MAP)) {
    if (mapped === field) {
      const row = amounts.find((a) => a.nutrientCode === code);
      if (row) return Number(row.amount);
    }
  }
  return null;
}

export function validateCnfDataset(dataset: CnfDataset): CnfValidationResult {
  const rejections: CnfValidationIssue[] = [];
  const warnings: CnfValidationIssue[] = [];
  const validFoodCodes = new Set<string>();
  const seenCodes = new Set<string>();

  for (const food of dataset.foods as CnfFoodNameRow[]) {
    if (seenCodes.has(food.foodCode)) {
      rejections.push({ foodCode: food.foodCode, reason: `duplicate Food_Code within the dataset` });
      continue;
    }
    seenCodes.add(food.foodCode);

    if (!dataset.foodGroups.has(food.foodGroupCode)) {
      rejections.push({ foodCode: food.foodCode, reason: `Food_Group_Code '${food.foodGroupCode}' does not resolve in CNF_Food_Group.csv` });
      continue;
    }

    const amounts = dataset.nutrientAmountsByFood.get(food.foodCode) ?? [];
    let unresolvedNutrient: string | null = null;
    for (const a of amounts) {
      if (!dataset.nutrientNames.has(a.nutrientCode)) {
        unresolvedNutrient = a.nutrientCode;
        break;
      }
    }
    if (unresolvedNutrient !== null) {
      rejections.push({ foodCode: food.foodCode, reason: `Nutrient_Code '${unresolvedNutrient}' does not resolve in Nutrient_Name.csv` });
      continue;
    }

    const moistureG = findByDedicatedField(amounts, 'moistureG');
    const proteinG = findByDedicatedField(amounts, 'proteinG');
    const ashG = findByDedicatedField(amounts, 'ashG');
    const fatG = findByDedicatedField(amounts, 'fatTotalG');
    const carbG = findByDedicatedField(amounts, 'carbohydratesG');
    const fiberG = findByDedicatedField(amounts, 'dietaryFiberG') ?? 0;
    const anyMeasured = [moistureG, proteinG, ashG, fatG].some((v) => v !== null);
    if (anyMeasured) {
      const sum = (moistureG ?? 0) + (proteinG ?? 0) + (ashG ?? 0) + (fatG ?? 0) + (carbG ?? 0);
      const deviation = Math.abs(sum - 100);
      if (deviation > PROXIMATE_SUM_WARN_TOLERANCE_G) {
        warnings.push({ foodCode: food.foodCode, reason: `proximate sum ${sum.toFixed(2)}g deviates ${deviation.toFixed(2)}g from 100g` });
      }
    }

    const energyKcal = findByDedicatedField(amounts, 'energyKcal');
    if (energyKcal !== null && energyKcal !== 0) {
      // Soft note reuses the shared, unmodified derived.ts helper (same one USDA/IFCT use).
      const note = energyConsistencyNote(energyKcal, proteinG, fatG, carbG);
      if (note) warnings.push({ foodCode: food.foodCode, reason: note });

      // A second, fibre-aware estimate (available carbohydrate = carb-by-difference minus
      // fibre) — verified directly against a real case (Allspice, food 169: reported 263kcal
      // deviates 49% from a naive total-carb estimate of 391kcal but is much closer to a fibre-
      // adjusted one, since dietary fibre contributes far less than 4kcal/g and CNF's own
      // reported KCAL is computed from available carbohydrate). Still informational only — see
      // this file's header comment for why CNF never hard-rejects on this heuristic.
      const availableCarbG = Math.max(0, (carbG ?? 0) - fiberG);
      const estimated = (proteinG ?? 0) * 4 + (fatG ?? 0) * 9 + availableCarbG * 4;
      if (estimated > 0) {
        const energyDeviation = Math.abs(energyKcal - estimated) / energyKcal;
        if (energyDeviation > ATWATER_WARN_DEVIATION) {
          warnings.push({ foodCode: food.foodCode, reason: `reported energy ${energyKcal.toFixed(0)}kcal deviates ${(energyDeviation * 100).toFixed(0)}% from fibre-adjusted Atwater estimate ${estimated.toFixed(0)}kcal` });
        }
      }
    }

    validFoodCodes.add(food.foodCode);
  }

  return { validFoodCodes, rejections, warnings };
}

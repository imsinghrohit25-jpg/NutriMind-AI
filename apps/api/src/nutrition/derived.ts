// Derived nutrition values — estimation rules per ADR-0007.
// All estimation is transparent: callers get both the estimate AND a flag indicating it.

import type { NutritionPer100g } from './canonical-model.js';
import { kcalToKj } from './units.js';

// Atwater general factors: protein = 4 kcal/g, fat = 9 kcal/g, carbohydrates = 4 kcal/g.
// Fibre contribution (2 kcal/g) omitted conservatively — prefer reported energy when available.
export function estimateEnergyKcal(
  proteinG: number | null,
  fatG: number | null,
  carbsG: number | null,
): number | null {
  if (proteinG === null && fatG === null && carbsG === null) return null;
  return (proteinG ?? 0) * 4 + (fatG ?? 0) * 9 + (carbsG ?? 0) * 4;
}

export function fillEnergyFields(nutrition: NutritionPer100g): void {
  if (nutrition.energyKcal === null) {
    const est = estimateEnergyKcal(nutrition.proteinG, nutrition.fatTotalG, nutrition.carbohydratesG);
    if (est !== null) nutrition.energyKcal = est;
  }
  if (nutrition.energyKj === null && nutrition.energyKcal !== null) {
    nutrition.energyKj = kcalToKj(nutrition.energyKcal);
  }
}

// ADR-0007: Added sugar estimation.
// Rule 1 — source provides `added_sugars` directly → use it, estimated = false.
// Rule 2 — not available → use total sugars as a conservative upper bound, estimated = true.
//           Rationale: total sugars ≥ added sugars by definition; this is the most honest
//           safe-harbour value when label data is absent.
// Rule 3 — neither field available → null / false (unknown, not estimated).
export function estimateAddedSugar(
  directAddedSugar: number | null | undefined,
  totalSugars: number | null,
): { sugarsAddedG: number | null; sugarsAddedEstimated: boolean } {
  if (directAddedSugar != null) {
    return { sugarsAddedG: directAddedSugar, sugarsAddedEstimated: false };
  }
  if (totalSugars != null) {
    return { sugarsAddedG: totalSugars, sugarsAddedEstimated: true };
  }
  return { sugarsAddedG: null, sugarsAddedEstimated: false };
}

// Energy consistency check per ADR-0007 §D4 (honesty).
// Returns a note string when the reported energy deviates >10% from the Atwater estimate.
// The reported value is always used — this only produces an explanatory note.
export function energyConsistencyNote(
  reportedKcal: number | null,
  proteinG: number | null,
  fatG: number | null,
  carbsG: number | null,
): string | null {
  if (reportedKcal === null || reportedKcal === 0) return null;
  const estimated = estimateEnergyKcal(proteinG, fatG, carbsG);
  if (estimated === null) return null;
  const deviation = Math.abs(reportedKcal - estimated) / reportedKcal;
  if (deviation > 0.1) {
    return `Reported energy ${Math.round(reportedKcal)} kcal deviates ${Math.round(deviation * 100)}% from Atwater estimate (${Math.round(estimated)} kcal); using reported value`;
  }
  return null;
}

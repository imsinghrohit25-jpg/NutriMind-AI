// nutrition.compute — Phase 13 (§16.3). "THE only source of calories/macros/scores." Wraps
// engines/score/engine.ts's computeHealthScore() directly. This is a significant finding worth
// recording: computeHealthScore() has had ZERO production callers anywhere in this build track
// since Phase 4 (ADR-0017 flagged this explicitly: "engine has zero production callers
// currently — that's the next real integration point"; no phase since ever wired it). This tool
// is the first real caller of the Health Score Engine in the Global Enterprise Edition rebuild.

import type { ToolDefinition, ToolContext } from '../types.js';
import { computeHealthScore, type HealthScoreResult } from '../../engines/score/engine.js';
import type { CanonicalProduct, NutritionPer100g } from '../../nutrition/canonical-model.js';
import { tokenizeIngredients } from '../../scan/ingredient-parser/tokenizer.js';

export interface NutritionComputeInput {
  product: CanonicalProduct;
  /** Grams actually consumed/planned to be consumed — when omitted, only per-100g figures are
   *  returned (no serving-size assumption is invented). */
  servingG?: number;
}

export interface NutritionComputeOutput {
  per100g: NutritionPer100g | null;
  /** Present only when `servingG` was supplied — a real scale-up of the per-100g figures, never
   *  an invented number. */
  perServing: Partial<NutritionPer100g> & { servingG: number } | null;
  score: HealthScoreResult | null;
  dataQualityGrade: 'A' | 'B' | 'C' | 'D';
}

const SCALABLE_FIELDS: (keyof NutritionPer100g)[] = [
  'energyKcal', 'proteinG', 'fatTotalG', 'fatSaturatedG', 'fatTransG',
  'carbohydratesG', 'sugarsG', 'sugarsAddedG', 'dietaryFiberG', 'sodiumMg',
];

function scaleToServing(per100g: NutritionPer100g, servingG: number): Partial<NutritionPer100g> & { servingG: number } {
  const factor = servingG / 100;
  const scaledFields: Partial<NutritionPer100g> = {};
  for (const field of SCALABLE_FIELDS) {
    const value = per100g[field];
    (scaledFields as Record<string, number | null>)[field] =
      typeof value === 'number' ? Math.round(value * factor * 10) / 10 : null;
  }
  return { ...scaledFields, servingG };
}

/** Data quality grade from real provenance/confidence signals — never a guess. Mirrors the
 *  grading language already used across scan/restaurant "ESTIMATED" flows (confidence <=0.6 or
 *  no confidence recorded => C/D, matching the existing cloud-OCR-fallback confidence cap and
 *  menu-scanner's estimation confidence ceiling of 0.35). */
function gradeDataQuality(per100g: NutritionPer100g | null): 'A' | 'B' | 'C' | 'D' {
  if (!per100g) return 'D';
  if (per100g.confidence == null) return per100g.licenseClass === 'open' ? 'B' : 'C';
  if (per100g.confidence >= 0.9) return 'A';
  if (per100g.confidence >= 0.6) return 'B';
  if (per100g.confidence >= 0.35) return 'C';
  return 'D';
}

export const nutritionComputeTool: ToolDefinition<NutritionComputeInput, NutritionComputeOutput> = {
  name: 'nutrition.compute',
  description: 'Compute the deterministic 0-100 health score and per-serving macros for a resolved product. The only source of calorie/macro/score numbers in the agent system.',
  execute: async (input) => {
    const { product, servingG } = input;
    const per100g = product.nutrition;

    if (!per100g) {
      return { per100g: null, perServing: null, score: null, dataQualityGrade: 'D' };
    }

    const ingredientNames = product.ingredientsRawText
      ? tokenizeIngredients(product.ingredientsRawText).map((t) => t.name)
      : [];

    const score = computeHealthScore({
      sodiumMg: per100g.sodiumMg,
      sugarsG: per100g.sugarsG,
      sugarsAddedG: per100g.sugarsAddedG,
      sugarsAddedEstimated: per100g.sugarsAddedEstimated,
      fatSaturatedG: per100g.fatSaturatedG,
      fatTransG: per100g.fatTransG,
      dietaryFiberG: per100g.dietaryFiberG,
      proteinG: per100g.proteinG,
      novaGroup: per100g.novaGroup,
      ingredientNames,
    });

    return {
      per100g,
      perServing: servingG != null ? scaleToServing(per100g, servingG) : null,
      score,
      dataQualityGrade: gradeDataQuality(per100g),
    };
  },
};

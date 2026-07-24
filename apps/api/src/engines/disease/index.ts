// Disease-aware nutrition evaluation — maps a user's stored health conditions
// (users_profiles.conditions / household_members.conditions) to the per-condition rule
// functions and returns UI-ready results.
//
// Design constraints (match the rest of engines/):
//   - Pure functions, no LLM, no I/O — callers fetch the profile and pass conditions in.
//   - Every triggered message carries citationIds resolvable via CITATIONS.
//   - Unknown condition slugs are ignored (profile stores free-form 'other' too).
//   - Output-policy safe: informational language only, no diagnosis/cure claims.

import type { NutritionPer100g } from '../../nutrition/canonical-model.js';
import { diabetesRule } from './rules/diabetes.js';
import { hypertensionRule } from './rules/hypertension.js';
import { highCholesterolRule } from './rules/high-cholesterol.js';
import { heartDiseaseRule } from './rules/heart-disease.js';
import { kidneyDiseaseRule } from './rules/kidney-disease.js';
import { fattyLiverRule } from './rules/fatty-liver.js';
import { pcosRule } from './rules/pcos.js';
import { thyroidRule } from './rules/thyroid.js';
import { pregnancyRule, lactationRule } from './rules/pregnancy.js';
import { obesityRule } from './rules/obesity.js';

export interface DiseaseRuleEvaluation {
  condition: string;        // profile slug, e.g. 'diabetes'
  conditionLabel: string;   // human-readable, e.g. 'Diabetes'
  triggered: boolean;
  severity: 'warning' | 'caution' | null;
  message: string | null;
  citationIds: string[];
}

/** Profile slug → display label. Must stay in sync with the mobile app's kConditionOptions. */
export const CONDITION_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension (High Blood Pressure)',
  high_cholesterol: 'High Cholesterol',
  heart_disease: 'Heart Disease',
  kidney_disease: 'Kidney Disease',
  thyroid: 'Thyroid Condition',
  pcos: 'PCOS',
  fatty_liver: 'Fatty Liver',
  pregnancy: 'Pregnancy',
  obesity: 'Obesity / Weight Management',
  lactation: 'Breastfeeding / Lactation',
};

/** Nutrition fields the evaluator reads — a structural subset of NutritionPer100g so callers
 *  holding plain JSON (e.g. a product row already serialized) can pass it without a cast dance. */
export type DiseaseRuleNutritionInput = Pick<
  NutritionPer100g,
  | 'energyKcal'
  | 'proteinG'
  | 'carbohydratesG'
  | 'sugarsG'
  | 'sugarsAddedG'
  | 'dietaryFiberG'
  | 'fatSaturatedG'
  | 'fatTransG'
  | 'sodiumMg'
  | 'potassiumMg'
  | 'cholesterolMg'
  | 'vitaminAIu'
>;

export function evaluateDiseaseRules(opts: {
  nutrition: Partial<DiseaseRuleNutritionInput> | null | undefined;
  ingredientsText?: string | null;
  conditions: string[];
  /** Declared medications (migration 0036) — currently sharpens only the thyroid rule's
   *  soy-timing caution. Optional; omitting it preserves the original, more conservative
   *  thyroid-rule behavior (always caution on soy when a thyroid condition is on file). */
  medications?: string[];
  /** Structured pregnancy/lactation status (migration 0036) — evaluated ALONGSIDE (not instead
   *  of) a 'pregnancy' entry in `conditions`, so either signal alone triggers pregnancy-safe
   *  guidance, and a 'lactating' status is evaluated even though there's no matching
   *  free-form condition chip for it. Optional; omitting it changes nothing. */
  reproductiveStatus?: string | null;
}): DiseaseRuleEvaluation[] {
  const { nutrition, ingredientsText, conditions, medications = [], reproductiveStatus } = opts;
  const n = nutrition ?? {};
  const results: DiseaseRuleEvaluation[] = [];

  for (const condition of conditions) {
    let result: { triggered: boolean; severity: 'warning' | 'caution' | null; message: string | null; citationIds: string[] } | null = null;

    switch (condition) {
      case 'diabetes':
        result = diabetesRule(n.sugarsG, n.sugarsAddedG);
        break;
      case 'hypertension':
        result = hypertensionRule(n.sodiumMg);
        break;
      case 'high_cholesterol':
        result = highCholesterolRule(n.fatSaturatedG, n.fatTransG, n.cholesterolMg);
        break;
      case 'heart_disease':
        result = heartDiseaseRule(n.sodiumMg, n.fatSaturatedG, n.fatTransG);
        break;
      case 'kidney_disease':
        result = kidneyDiseaseRule(n.sodiumMg, n.potassiumMg, n.proteinG);
        break;
      case 'fatty_liver':
        result = fattyLiverRule(n.sugarsG, n.sugarsAddedG, n.fatSaturatedG);
        break;
      case 'pcos':
        result = pcosRule(n.sugarsG, n.sugarsAddedG, n.carbohydratesG, n.dietaryFiberG);
        break;
      case 'thyroid':
        result = thyroidRule(ingredientsText, medications);
        break;
      case 'pregnancy':
        result = pregnancyRule(n.vitaminAIu, ingredientsText);
        break;
      case 'obesity':
        result = obesityRule(n.energyKcal, n.sugarsG, n.sugarsAddedG);
        break;
      default:
        continue; // unknown slug ('other', legacy values) — nothing to evaluate
    }

    results.push({
      condition,
      conditionLabel: CONDITION_LABELS[condition] ?? condition,
      ...result,
    });
  }

  // Structured reproductive_status signal — additive to (never replacing) the conditions[] loop
  // above. A 'pregnant' status when 'pregnancy' isn't already a ticked condition still gets
  // pregnancy-safe guidance; 'lactating' has no equivalent condition chip at all, so this is its
  // only path to ever being evaluated.
  if (reproductiveStatus === 'pregnant' && !conditions.includes('pregnancy')) {
    const result = pregnancyRule(n.vitaminAIu, ingredientsText);
    results.push({ condition: 'pregnancy', conditionLabel: CONDITION_LABELS.pregnancy!, ...result });
  } else if (reproductiveStatus === 'lactating') {
    const result = lactationRule(ingredientsText);
    results.push({ condition: 'lactation', conditionLabel: CONDITION_LABELS.lactation!, ...result });
  }

  return results;
}

/** Convenience for meal-level suitability: worst severity across evaluations, or null. */
export function worstSeverity(evaluations: DiseaseRuleEvaluation[]): 'warning' | 'caution' | null {
  if (evaluations.some((e) => e.triggered && e.severity === 'warning')) return 'warning';
  if (evaluations.some((e) => e.triggered && e.severity === 'caution')) return 'caution';
  return null;
}

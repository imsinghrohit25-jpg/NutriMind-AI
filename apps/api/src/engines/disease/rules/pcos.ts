// PCOS nutrition rules — pure function, no LLM.
// Insulin resistance is central to PCOS; guidance targets free sugars and refined
// carbohydrate quality (low fiber relative to carbs).
// Source: International Evidence-based PCOS Guideline (ESHRE/Monash) 2023; WHO Sugar 2015.

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

const PCOS_SUGAR_WARNING_G_PER_100G = 10;
const PCOS_SUGAR_CAUTION_G_PER_100G = 5;
// Refined-carb proxy: substantial carbs with almost no fiber.
const PCOS_REFINED_CARB_MIN_G_PER_100G = 40;
const PCOS_REFINED_FIBER_MAX_G_PER_100G = 2;

export function pcosRule(
  sugarsG: number | null | undefined,
  sugarsAddedG: number | null | undefined,
  carbohydratesG: number | null | undefined,
  dietaryFiberG: number | null | undefined,
): ConditionRuleResult {
  const sugarValue = sugarsAddedG ?? sugarsG;

  if (sugarValue != null && sugarValue > PCOS_SUGAR_WARNING_G_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `High sugar content (${sugarValue.toFixed(1)}g/100g). PCOS guidelines recommend ` +
        `limiting free sugars: most people with PCOS have some degree of insulin resistance, ` +
        `and high-sugar foods work against glycaemic and weight-management goals.`,
      citationIds: ['eshre-pcos-2023', 'who-sugar-2015'],
    };
  }

  const isRefinedCarb =
    carbohydratesG != null &&
    carbohydratesG > PCOS_REFINED_CARB_MIN_G_PER_100G &&
    (dietaryFiberG == null || dietaryFiberG < PCOS_REFINED_FIBER_MAX_G_PER_100G);

  if ((sugarValue != null && sugarValue > PCOS_SUGAR_CAUTION_G_PER_100G) || isRefinedCarb) {
    return {
      triggered: true,
      severity: 'caution',
      message: isRefinedCarb
        ? `Mostly refined carbohydrate (${carbohydratesG!.toFixed(0)}g carbs with ` +
          `${(dietaryFiberG ?? 0).toFixed(1)}g fiber per 100g). For PCOS, guidelines favour ` +
          `higher-fiber, lower-glycaemic carbohydrate choices.`
        : `Moderate sugar (${sugarValue!.toFixed(1)}g/100g). If managing PCOS, watch portion ` +
          `size and pair with fiber or protein to blunt the glycaemic response.`,
      citationIds: ['eshre-pcos-2023'],
    };
  }

  return NOT_TRIGGERED;
}

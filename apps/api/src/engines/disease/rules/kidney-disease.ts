// Chronic kidney disease nutrition rules — pure function, no LLM.
// CKD diets restrict sodium, potassium, and (pre-dialysis) protein.
// Source: KDOQI Clinical Practice Guideline for Nutrition in CKD 2020; WHO Sodium 2023.

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

const CKD_SODIUM_WARNING_MG_PER_100G = 300;
const CKD_SODIUM_CAUTION_MG_PER_100G = 150;
const CKD_POTASSIUM_CAUTION_MG_PER_100G = 300;
const CKD_PROTEIN_CAUTION_G_PER_100G = 15;

export function kidneyDiseaseRule(
  sodiumMg: number | null | undefined,
  potassiumMg: number | null | undefined,
  proteinG: number | null | undefined,
): ConditionRuleResult {
  if (sodiumMg != null && sodiumMg > CKD_SODIUM_WARNING_MG_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `High sodium (${sodiumMg.toFixed(0)}mg/100g). KDOQI guidelines recommend people with ` +
        `chronic kidney disease limit sodium to under 2300mg/day — a serving of this product ` +
        `may use a large share of that.`,
      citationIds: ['kdoqi-nutrition-ckd-2020', 'who-sodium-2023'],
    };
  }

  const cautions: string[] = [];
  if (sodiumMg != null && sodiumMg > CKD_SODIUM_CAUTION_MG_PER_100G) {
    cautions.push(`moderate sodium (${sodiumMg.toFixed(0)}mg/100g)`);
  }
  if (potassiumMg != null && potassiumMg > CKD_POTASSIUM_CAUTION_MG_PER_100G) {
    cautions.push(`notable potassium (${potassiumMg.toFixed(0)}mg/100g)`);
  }
  if (proteinG != null && proteinG > CKD_PROTEIN_CAUTION_G_PER_100G) {
    cautions.push(`high protein (${proteinG.toFixed(1)}g/100g)`);
  }

  if (cautions.length > 0) {
    return {
      triggered: true,
      severity: 'caution',
      message:
        `This product has ${cautions.join(', ')}. Depending on your CKD stage, your care team ` +
        `may recommend limits on sodium, potassium, and protein — check this fits your ` +
        `prescribed intake.`,
      citationIds: ['kdoqi-nutrition-ckd-2020'],
    };
  }

  return NOT_TRIGGERED;
}

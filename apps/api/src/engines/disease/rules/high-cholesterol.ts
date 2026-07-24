// High-cholesterol (dyslipidaemia) nutrition rules — pure function, no LLM.
// Source: WHO Saturated/Trans Fatty Acid Guideline 2023; WHO Trans Fat Elimination 2023;
// ESC CVD Prevention Guidelines 2021.

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

const CHOL_SATFAT_WARNING_G_PER_100G = 5;
const CHOL_SATFAT_CAUTION_G_PER_100G = 1.5;
const CHOL_TRANSFAT_WARNING_G_PER_100G = 0.5;
const CHOL_DIETARY_CHOLESTEROL_CAUTION_MG_PER_100G = 100;

export function highCholesterolRule(
  fatSaturatedG: number | null | undefined,
  fatTransG: number | null | undefined,
  cholesterolMg: number | null | undefined,
): ConditionRuleResult {
  if (fatTransG != null && fatTransG >= CHOL_TRANSFAT_WARNING_G_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product contains ${fatTransG.toFixed(1)}g trans fat per 100g. ` +
        `Trans fats raise LDL ("bad") cholesterol and lower HDL. WHO recommends eliminating ` +
        `industrially-produced trans fats from the diet entirely.`,
      citationIds: ['who-transfat-2023', 'who-satfat-2023'],
    };
  }

  if (fatSaturatedG != null && fatSaturatedG > CHOL_SATFAT_WARNING_G_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `High saturated fat (${fatSaturatedG.toFixed(1)}g/100g). For people managing high ` +
        `cholesterol, WHO recommends keeping saturated fat below 10% of daily energy and ` +
        `replacing it with unsaturated fats.`,
      citationIds: ['who-satfat-2023', 'esc-cvd-prevention-2021'],
    };
  }

  if (
    (fatSaturatedG != null && fatSaturatedG > CHOL_SATFAT_CAUTION_G_PER_100G) ||
    (cholesterolMg != null && cholesterolMg > CHOL_DIETARY_CHOLESTEROL_CAUTION_MG_PER_100G)
  ) {
    const parts: string[] = [];
    if (fatSaturatedG != null && fatSaturatedG > CHOL_SATFAT_CAUTION_G_PER_100G) {
      parts.push(`moderate saturated fat (${fatSaturatedG.toFixed(1)}g/100g)`);
    }
    if (cholesterolMg != null && cholesterolMg > CHOL_DIETARY_CHOLESTEROL_CAUTION_MG_PER_100G) {
      parts.push(`dietary cholesterol (${cholesterolMg.toFixed(0)}mg/100g)`);
    }
    return {
      triggered: true,
      severity: 'caution',
      message:
        `This product has ${parts.join(' and ')}. ` +
        `If managing cholesterol levels, monitor portion size and overall saturated fat intake.`,
      citationIds: ['who-satfat-2023'],
    };
  }

  return NOT_TRIGGERED;
}

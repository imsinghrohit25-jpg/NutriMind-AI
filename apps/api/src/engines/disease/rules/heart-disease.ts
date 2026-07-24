// Heart-disease (established CVD) nutrition rules — pure function, no LLM.
// Stricter than the general-population and high-cholesterol rules: combines sodium,
// saturated fat, and trans fat, since all three are primary dietary CVD risk factors.
// Source: ESC CVD Prevention 2021; WHO Sodium 2023; WHO SFA/TFA 2023.

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

const HD_SODIUM_WARNING_MG_PER_100G = 300;
const HD_SODIUM_CAUTION_MG_PER_100G = 150;
const HD_SATFAT_WARNING_G_PER_100G = 5;
const HD_SATFAT_CAUTION_G_PER_100G = 1.5;
const HD_TRANSFAT_WARNING_G_PER_100G = 0.2; // any measurable industrial trans fat

export function heartDiseaseRule(
  sodiumMg: number | null | undefined,
  fatSaturatedG: number | null | undefined,
  fatTransG: number | null | undefined,
): ConditionRuleResult {
  const warnings: string[] = [];
  const cautions: string[] = [];

  if (fatTransG != null && fatTransG >= HD_TRANSFAT_WARNING_G_PER_100G) {
    warnings.push(`trans fat (${fatTransG.toFixed(1)}g/100g)`);
  }
  if (sodiumMg != null && sodiumMg > HD_SODIUM_WARNING_MG_PER_100G) {
    warnings.push(`sodium (${sodiumMg.toFixed(0)}mg/100g)`);
  } else if (sodiumMg != null && sodiumMg > HD_SODIUM_CAUTION_MG_PER_100G) {
    cautions.push(`sodium (${sodiumMg.toFixed(0)}mg/100g)`);
  }
  if (fatSaturatedG != null && fatSaturatedG > HD_SATFAT_WARNING_G_PER_100G) {
    warnings.push(`saturated fat (${fatSaturatedG.toFixed(1)}g/100g)`);
  } else if (fatSaturatedG != null && fatSaturatedG > HD_SATFAT_CAUTION_G_PER_100G) {
    cautions.push(`saturated fat (${fatSaturatedG.toFixed(1)}g/100g)`);
  }

  if (warnings.length > 0) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product is high in ${warnings.join(', ')}. For people managing heart disease, ` +
        `guidelines recommend limiting sodium (< 2000mg/day), keeping saturated fat below 10% of ` +
        `energy, and avoiding trans fats entirely.`,
      citationIds: ['esc-cvd-prevention-2021', 'who-sodium-2023', 'who-satfat-2023'],
    };
  }

  if (cautions.length > 0) {
    return {
      triggered: true,
      severity: 'caution',
      message:
        `Moderate ${cautions.join(' and ')}. If managing a heart condition, keep an eye on ` +
        `total daily sodium and saturated fat intake.`,
      citationIds: ['esc-cvd-prevention-2021'],
    };
  }

  return NOT_TRIGGERED;
}

// Fatty liver (NAFLD/MASLD) nutrition rules — pure function, no LLM.
// Free sugars (especially fructose) and saturated fat are the primary dietary drivers.
// Source: EASL–EASD–EASO NAFLD Guidelines 2016; WHO Sugar Guideline 2015; WHO SFA/TFA 2023.

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

const FL_SUGAR_WARNING_G_PER_100G = 10;
const FL_SUGAR_CAUTION_G_PER_100G = 5;
const FL_SATFAT_CAUTION_G_PER_100G = 5;

export function fattyLiverRule(
  sugarsG: number | null | undefined,
  sugarsAddedG: number | null | undefined,
  fatSaturatedG: number | null | undefined,
): ConditionRuleResult {
  const sugarValue = sugarsAddedG ?? sugarsG;

  if (sugarValue != null && sugarValue > FL_SUGAR_WARNING_G_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `High sugar content (${sugarValue.toFixed(1)}g/100g). EASL guidelines specifically ` +
        `recommend people managing fatty liver disease avoid added sugars and ` +
        `fructose-sweetened foods and drinks, which drive liver fat accumulation.`,
      citationIds: ['easl-nafld-2016', 'who-sugar-2015'],
    };
  }

  const cautions: string[] = [];
  if (sugarValue != null && sugarValue > FL_SUGAR_CAUTION_G_PER_100G) {
    cautions.push(`moderate sugar (${sugarValue.toFixed(1)}g/100g)`);
  }
  if (fatSaturatedG != null && fatSaturatedG > FL_SATFAT_CAUTION_G_PER_100G) {
    cautions.push(`high saturated fat (${fatSaturatedG.toFixed(1)}g/100g)`);
  }

  if (cautions.length > 0) {
    return {
      triggered: true,
      severity: 'caution',
      message:
        `This product has ${cautions.join(' and ')}. For fatty liver management, guidelines ` +
        `favour a Mediterranean-style pattern low in added sugar and saturated fat.`,
      citationIds: ['easl-nafld-2016'],
    };
  }

  return NOT_TRIGGERED;
}

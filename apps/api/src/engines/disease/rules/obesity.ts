// Obesity / weight-management nutrition rules — pure function, no LLM.
// Energy density and free sugars are the two levers with the strongest evidence base for
// packaged foods. Thresholds follow WHO healthy-diet guidance and ICMR-NIN 2020.
// Source: WHO Healthy Diet Fact Sheet 2020; WHO Sugar 2015; ICMR-NIN RDA 2020.

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

const OB_ENERGY_WARNING_KCAL_PER_100G = 500;
const OB_ENERGY_CAUTION_KCAL_PER_100G = 400;
const OB_SUGAR_CAUTION_G_PER_100G = 10;

export function obesityRule(
  energyKcal: number | null | undefined,
  sugarsG: number | null | undefined,
  sugarsAddedG: number | null | undefined,
): ConditionRuleResult {
  const sugarValue = sugarsAddedG ?? sugarsG;

  if (energyKcal != null && energyKcal > OB_ENERGY_WARNING_KCAL_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `Very energy-dense (${energyKcal.toFixed(0)} kcal/100g). For weight management, ` +
        `WHO guidance favours foods with lower energy density — a small portion of this ` +
        `product carries a large share of a day's energy budget.`,
      citationIds: ['who-healthy-diet-2020', 'icmr-nin-2020'],
    };
  }

  const cautions: string[] = [];
  if (energyKcal != null && energyKcal > OB_ENERGY_CAUTION_KCAL_PER_100G) {
    cautions.push(`energy-dense (${energyKcal.toFixed(0)} kcal/100g)`);
  }
  if (sugarValue != null && sugarValue > OB_SUGAR_CAUTION_G_PER_100G) {
    cautions.push(`high in sugar (${sugarValue.toFixed(1)}g/100g)`);
  }

  if (cautions.length > 0) {
    return {
      triggered: true,
      severity: 'caution',
      message:
        `This product is ${cautions.join(' and ')}. If weight management is a goal, ` +
        `watch portion size — WHO recommends free sugars stay under 10% of daily energy.`,
      citationIds: ['who-healthy-diet-2020', 'who-sugar-2015'],
    };
  }

  return NOT_TRIGGERED;
}

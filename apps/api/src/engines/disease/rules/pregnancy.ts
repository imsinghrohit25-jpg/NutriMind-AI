// Pregnancy nutrition rules — pure function, no LLM.
// Two well-evidenced packaged-food risks are detectable from our data model:
//   1. Excess preformed vitamin A (retinol) — teratogenic in high doses.
//   2. Unpasteurised dairy / raw ingredients — listeria risk.
// Alcohol-containing products are flagged from the ingredient list as well.
// Source: WHO Antenatal Care Recommendations 2016.

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

// WHO cautions against routine vitamin A supplementation in pregnancy above 10,000 IU/day.
// Per-100g thresholds are set so a normal serving stays well under that ceiling.
const PREG_VITA_WARNING_IU_PER_100G = 5000;
const PREG_VITA_CAUTION_IU_PER_100G = 2500;

const UNPASTEURISED_PATTERN = /\bunpasteuri[sz]ed\b|\braw\s+milk\b|\braw\s+cheese\b/i;
const ALCOHOL_PATTERN = /\balcohol\b|\bethanol\b|\bwine\b|\bbeer\b|\brum\b|\bwhisky\b|\bbrandy\b/i;

export function pregnancyRule(
  vitaminAIu: number | null | undefined,
  ingredientsText: string | null | undefined,
): ConditionRuleResult {
  if (ingredientsText && ALCOHOL_PATTERN.test(ingredientsText)) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product appears to contain alcohol. There is no known safe level of alcohol ` +
        `in pregnancy — WHO recommends avoiding it entirely.`,
      citationIds: ['who-antenatal-2016'],
    };
  }

  if (ingredientsText && UNPASTEURISED_PATTERN.test(ingredientsText)) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product appears to contain unpasteurised milk or raw dairy. During pregnancy, ` +
        `unpasteurised dairy carries a listeria risk and is best avoided.`,
      citationIds: ['who-antenatal-2016'],
    };
  }

  if (vitaminAIu != null && vitaminAIu > PREG_VITA_WARNING_IU_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `Very high preformed vitamin A (${vitaminAIu.toFixed(0)} IU/100g). Excess retinol in ` +
        `pregnancy is associated with birth defects — WHO advises keeping total intake well ` +
        `below 10,000 IU/day. Check with your antenatal care provider.`,
      citationIds: ['who-antenatal-2016'],
    };
  }

  if (vitaminAIu != null && vitaminAIu > PREG_VITA_CAUTION_IU_PER_100G) {
    return {
      triggered: true,
      severity: 'caution',
      message:
        `Notable vitamin A content (${vitaminAIu.toFixed(0)} IU/100g). Fine in normal portions, ` +
        `but if you're pregnant keep an eye on total daily vitamin A from all foods and supplements.`,
      citationIds: ['who-antenatal-2016'],
    };
  }

  return NOT_TRIGGERED;
}

// Lactation rules — distinct from pregnancy (migration 0036's `reproductive_status`): alcohol and
// mercury-limit fish still matter (both pass into breast milk), but the vitamin A ceiling that
// matters in pregnancy (teratogenicity) doesn't apply post-birth, so that check is intentionally
// NOT reused here. Source: WHO Antenatal Care Recommendations 2016 (alcohol guidance extends to
// lactation in WHO's own infant feeding guidance); FDA/EPA mercury-in-fish advice for nursing
// parents mirrors the pregnancy advice.
const HIGH_MERCURY_FISH_PATTERN = /\bshark\b|\bswordfish\b|\bking\s*mackerel\b|\btilefish\b/i;

export function lactationRule(ingredientsText: string | null | undefined): ConditionRuleResult {
  if (ingredientsText && ALCOHOL_PATTERN.test(ingredientsText)) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product appears to contain alcohol. Alcohol passes into breast milk — the safest ` +
        `approach while breastfeeding is to avoid it, or wait at least 2-3 hours per drink before nursing.`,
      citationIds: ['who-antenatal-2016'],
    };
  }

  if (ingredientsText && HIGH_MERCURY_FISH_PATTERN.test(ingredientsText)) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product contains a high-mercury fish. While breastfeeding, it's best to limit or ` +
        `avoid high-mercury fish (shark, swordfish, king mackerel) — mercury can pass into breast milk.`,
      citationIds: ['who-antenatal-2016'],
    };
  }

  return NOT_TRIGGERED;
}

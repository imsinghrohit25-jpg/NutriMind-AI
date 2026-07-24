// Thyroid condition nutrition rules — pure function, no LLM.
// Packaged-food nutrients rarely matter for thyroid conditions; what does matter (and is
// well-documented) is soy interfering with levothyroxine absorption. This rule is therefore
// ingredients-driven, not threshold-driven — no ingredient list means no trigger, by design.
// Source: ATA Guidelines for the Treatment of Hypothyroidism 2014 (drug–food interactions).

import type { ConditionRuleResult } from './types.js';
import { NOT_TRIGGERED } from './types.js';

const SOY_PATTERN = /\bsoy(?:a)?\b|\bsoy(?:a)?\s*(?:protein|flour|lecithin|milk|isolate)|\btofu\b|\bedamame\b/i;

// Thyroid-hormone replacement drug names (generic + common brand names) — used to sharpen the
// soy-timing caution below when the user has declared their medications (migration 0036). Not
// an exhaustive pharmacy database; covers the medications this interaction is actually about.
const THYROID_MEDICATION_PATTERN = /\b(levothyroxine|eltroxin|synthroid|thyronorm|thyroxine|euthyrox|levoxyl)\b/i;

export function thyroidRule(
  ingredientsText: string | null | undefined,
  medications: string[] = [],
): ConditionRuleResult {
  if (!ingredientsText) return NOT_TRIGGERED;

  // When the user HAS declared medications and NONE of them are a thyroid-hormone replacement,
  // the soy/medication-timing interaction doesn't apply to them — skip rather than warn about an
  // interaction with a drug they're not taking. When medications is empty (not asked, or asked
  // and genuinely has none on file), fall back to the original conservative behavior: a thyroid
  // condition on file at all is treated as enough reason to mention the interaction, since we
  // can't be sure whether they're on medication.
  const declaredMedications = medications.length > 0;
  const onThyroidMedication = medications.some((m) => THYROID_MEDICATION_PATTERN.test(m));
  if (declaredMedications && !onThyroidMedication) return NOT_TRIGGERED;

  if (SOY_PATTERN.test(ingredientsText)) {
    const medicationClause = onThyroidMedication
      ? ` Since you've noted a thyroid medication, this is worth paying attention to.`
      : '';
    return {
      triggered: true,
      severity: 'caution',
      message:
        `This product contains soy. Soy does not need to be avoided with a thyroid condition, ` +
        `but it can reduce absorption of thyroid hormone medication (levothyroxine) — ATA ` +
        `guidance is to separate soy-containing foods from your medication dose by several hours.` +
        medicationClause,
      citationIds: ['ata-hypothyroidism-2014'],
    };
  }

  return NOT_TRIGGERED;
}

// Hypertension nutrition rules — pure function, no LLM.
// Source: WHO Hypertension Report 2021; WHO Sodium Guideline 2023; ICMR-NIN 2020.
// India has one of the highest hypertension burdens globally (~30% of adults).

export interface HypertensionRuleResult {
  triggered: boolean;
  severity: 'warning' | 'caution' | null;
  message: string | null;
  citationIds: string[];
}

// Sodium thresholds for hypertension (stricter than general population)
const HTN_SODIUM_WARNING_MG_PER_100G  = 300;  // single serving likely exceeds daily limit
const HTN_SODIUM_CAUTION_MG_PER_100G  = 150;

export function hypertensionRule(sodiumMg: number | null | undefined): HypertensionRuleResult {
  if (sodiumMg === null || sodiumMg === undefined) {
    return { triggered: false, severity: null, message: null, citationIds: [] };
  }

  if (sodiumMg > HTN_SODIUM_WARNING_MG_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product contains ${sodiumMg} mg sodium per 100g. ` +
        `For people managing high blood pressure, WHO recommends < 2000 mg sodium/day total. ` +
        `A typical serving of this product may supply a significant portion of that limit.`,
      citationIds: ['who-sodium-2023', 'who-hypertension-2021'],
    };
  }

  if (sodiumMg > HTN_SODIUM_CAUTION_MG_PER_100G) {
    return {
      triggered: true,
      severity: 'caution',
      message:
        `This product has moderate sodium (${sodiumMg} mg/100g). ` +
        `If managing blood pressure, monitor total daily sodium intake. ` +
        `WHO recommends < 2000 mg/day.`,
      citationIds: ['who-sodium-2023'],
    };
  }

  return { triggered: false, severity: null, message: null, citationIds: [] };
}

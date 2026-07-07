// Type-2 diabetes nutrition rules — pure function, no LLM.
// Source: RSSDI-ESI Clinical Practice Recommendations 2018; WHO Sugar Guideline 2015.

export interface DiabetesRuleResult {
  triggered: boolean;
  severity: 'warning' | 'caution' | null;
  message: string | null;
  citationIds: string[];
}

const T2D_SUGAR_WARNING_G_PER_100G  = 10;   // total or added sugars
const T2D_SUGAR_CAUTION_G_PER_100G  =  5;

export function diabetesRule(
  sugarsG: number | null | undefined,
  sugarsAddedG: number | null | undefined,
): DiabetesRuleResult {
  const sugarValue = sugarsAddedG ?? sugarsG;

  if (sugarValue === null || sugarValue === undefined) {
    return { triggered: false, severity: null, message: null, citationIds: [] };
  }

  if (sugarValue > T2D_SUGAR_WARNING_G_PER_100G) {
    return {
      triggered: true,
      severity: 'warning',
      message:
        `This product contains ${sugarValue.toFixed(1)}g sugar per 100g. ` +
        `For people managing type 2 diabetes, the RSSDI-ESI guidelines recommend ` +
        `limiting free sugar intake and choosing low-glycaemic alternatives. ` +
        `WHO recommends < 10% of daily energy from free sugars.`,
      citationIds: ['icmr-diabetes-2018', 'who-sugar-2015'],
    };
  }

  if (sugarValue > T2D_SUGAR_CAUTION_G_PER_100G) {
    return {
      triggered: true,
      severity: 'caution',
      message:
        `Moderate sugar content (${sugarValue.toFixed(1)}g/100g). ` +
        `If managing blood glucose, monitor portion size.`,
      citationIds: ['who-sugar-2015'],
    };
  }

  return { triggered: false, severity: null, message: null, citationIds: [] };
}

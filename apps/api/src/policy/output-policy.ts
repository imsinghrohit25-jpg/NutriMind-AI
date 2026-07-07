export interface PolicyResult {
  ok: boolean;
  violations: string[];
}

const DIAGNOSIS_PATTERNS: RegExp[] = [
  /\b(diagnos(?:e|is|ed|ing)|you have|you're suffering from|you suffer from)\b/gi,
  /\bthis (?:will |can |could )?cure\b/gi,
  /\bmedical(?:ly)? (?:proven|guaranteed|certified)\b/gi,
  /\bguaranteed to (?:treat|cure|heal|prevent)\b/gi,
  /\bstop (?:taking|using) your (?:medication|medicine|prescription|drug)\b/gi,
  /\bno longer need (?:your )?(?:medication|insulin|prescription)\b/gi,
  /\breplace (?:your )?(?:medication|doctor|physician|treatment)\b/gi,
  /\bseek immediate (?:medical )?attention\b/gi,
];

const MEDICAL_PRESCRIPTION_PATTERNS: RegExp[] = [
  /\b(?:take|consume|ingest) (?:\d+ ?(?:mg|mcg|g|ml|tablets?|pills?|doses?))\b/gi,
  /\bprescribe[sd]?\b/gi,
  /\b(?:clinical|medical) (?:dose|dosage|treatment)\b/gi,
];

const SCORE_CONTRADICTION_THRESHOLD = 3.0;

const POSITIVE_HEALTH_SIGNALS: RegExp[] = [
  /\b(?:very healthy|extremely healthy|highly nutritious|excellent (?:for )?health|superfood|miracle food)\b/gi,
];

const NEGATIVE_HEALTH_SIGNALS: RegExp[] = [
  /\b(?:very unhealthy|extremely unhealthy|highly harmful|dangerous|toxic|poison)\b/gi,
];

export function checkOutputPolicy(
  content: string,
  context?: { healthScore?: number; isNutritionContext?: boolean },
): PolicyResult {
  const violations: string[] = [];

  for (const pattern of DIAGNOSIS_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`forbidden-diagnosis: matched /${pattern.source}/`);
    }
    pattern.lastIndex = 0;
  }

  if (context?.isNutritionContext) {
    for (const pattern of MEDICAL_PRESCRIPTION_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`forbidden-prescription: matched /${pattern.source}/`);
      }
      pattern.lastIndex = 0;
    }
  }

  if (context?.healthScore !== undefined) {
    const score = context.healthScore;

    if (score < SCORE_CONTRADICTION_THRESHOLD) {
      for (const pattern of POSITIVE_HEALTH_SIGNALS) {
        if (pattern.test(content)) {
          violations.push(
            `score-contradiction: LLM says product is healthy (score=${score.toFixed(1)}<${SCORE_CONTRADICTION_THRESHOLD})`,
          );
        }
        pattern.lastIndex = 0;
      }
    }

    if (score >= 7.0) {
      for (const pattern of NEGATIVE_HEALTH_SIGNALS) {
        if (pattern.test(content)) {
          violations.push(
            `score-contradiction: LLM says product is unhealthy (score=${score.toFixed(1)}≥7.0)`,
          );
        }
        pattern.lastIndex = 0;
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

export function requiresDisclaimer(tier: string, content: string): boolean {
  const healthKeywords = /\b(?:health|nutrition|diet|calories?|protein|fat|carb|sugar|sodium|vitamin|mineral|allerg|disease|diabete|hypertension|heart|cholesterol)\b/gi;
  return tier === 'copilot_reasoning' && healthKeywords.test(content);
}

// Grounding verifier — verifies that LLM answer claims are supported by retrieved chunks.
// Gate requirement: fabricated claims must be caught.
// This is a deterministic heuristic; does not call LLM.
//
// Approach: extract key factual phrases from the answer and check if they appear
// in the retrieved chunks. If a numeric claim (e.g. "2000 mg sodium") appears in
// the answer but NOT in any chunk, it is flagged as ungrounded.

export interface GroundingViolation {
  phrase:       string;
  reason:       string;
}

export interface GroundingResult {
  isGrounded:   boolean;
  violations:   GroundingViolation[];
  groundedText: string;   // answer text with ungrounded sections flagged
}

// Patterns that indicate a specific numeric or regulatory claim
const NUMERIC_CLAIM_REGEX = /\b(\d[\d,.]*\s*(mg|g|kcal|ml|%|mmHg|mmol|IU|µg|mcg))\b/gi;
const YEAR_CLAIM_REGEX = /\b(19|20)\d{2}\b/g;
const THRESHOLD_CLAIM_REGEX = /\b(less than|more than|below|above|up to|at least|no more than)\s+[\d,.]+/gi;

export function verifyGrounding(
  answer: string,
  retrievedChunks: Array<{ text: string; chunkId: string }>,
): GroundingResult {
  const chunkTexts = retrievedChunks.map((c) => c.text.toLowerCase()).join('\n');
  const violations: GroundingViolation[] = [];

  // Extract numeric claims from answer
  const numericMatches = [...answer.matchAll(NUMERIC_CLAIM_REGEX)];
  for (const match of numericMatches) {
    const phrase = match[0].toLowerCase();
    if (!chunkTexts.includes(phrase)) {
      violations.push({
        phrase: match[0],
        reason: `Numeric claim "${match[0]}" not found in retrieved knowledge chunks`,
      });
    }
  }

  // Extract threshold claims
  const thresholdMatches = [...answer.matchAll(THRESHOLD_CLAIM_REGEX)];
  for (const match of thresholdMatches) {
    const phrase = match[0].toLowerCase();
    if (!chunkTexts.includes(phrase)) {
      violations.push({
        phrase: match[0],
        reason: `Threshold claim "${match[0]}" not found in retrieved knowledge chunks`,
      });
    }
  }

  // If more than 30% of numeric claims are ungrounded, mark answer as not grounded
  const totalNumericClaims = numericMatches.length + thresholdMatches.length;
  const ungroundedCount = violations.length;
  const isGrounded = totalNumericClaims === 0 || (ungroundedCount / totalNumericClaims) < 0.3;

  const groundedText = isGrounded
    ? answer
    : `[Note: Some numerical claims in this response could not be verified against the knowledge base. Please verify with official sources.]\n\n${answer}`;

  return { isGrounded, violations, groundedText };
}

// Allergen fail-safe — pure function.
// When OCR parse quality is too low to reliably identify ingredients,
// the fail-safe emits a blanket warning for all profile allergens.
// This is the "negative test": a low-confidence OCR result MUST NOT silently pass.

import { AllergenId } from './taxonomy.js';

export type ParseQuality = 'high' | 'medium' | 'low' | 'unknown';

export interface FailSafeResult {
  triggered: boolean;
  reason: string | null;
  warningAllergenIds: AllergenId[];
}

// Threshold below which allergen detection is considered unreliable
const FAIL_SAFE_OCR_CONFIDENCE_THRESHOLD = 0.5;

export function allergenFailSafe(
  ocrConfidence: number | null | undefined,
  parseQuality: ParseQuality,
  profileAllergens: AllergenId[],
): FailSafeResult {
  if (profileAllergens.length === 0) {
    return { triggered: false, reason: null, warningAllergenIds: [] };
  }

  // Low or unknown OCR confidence — ingredient list cannot be trusted
  if (
    ocrConfidence === null ||
    ocrConfidence === undefined ||
    ocrConfidence < FAIL_SAFE_OCR_CONFIDENCE_THRESHOLD
  ) {
    return {
      triggered: true,
      reason:
        `OCR confidence is ${ocrConfidence?.toFixed(2) ?? 'unknown'} ` +
        `(threshold: ${FAIL_SAFE_OCR_CONFIDENCE_THRESHOLD}). ` +
        `Ingredient list may be incomplete. Cannot reliably verify allergen absence.`,
      warningAllergenIds: profileAllergens,
    };
  }

  // Low parse quality (e.g., heavily damaged or blurry label)
  if (parseQuality === 'low' || parseQuality === 'unknown') {
    return {
      triggered: true,
      reason:
        `Label parse quality is "${parseQuality}". ` +
        `Ingredient list may be unreliable. Cannot confirm allergen absence.`,
      warningAllergenIds: profileAllergens,
    };
  }

  return { triggered: false, reason: null, warningAllergenIds: [] };
}

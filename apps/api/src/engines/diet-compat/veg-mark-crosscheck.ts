// Veg-mark cross-check — pure function.
// FSSAI mandates a green circle (veg) or red/brown circle (non-veg) on all packaged food.
// This function detects mismatches between the declared veg mark and ingredient list.
// Gate requirement: veg-mark mismatch must be flagged.

import { MEAT_KEYWORDS } from './rules/vegetarian-keywords.js';

export type VegMark = 'veg' | 'non-veg' | 'unknown';

export interface VegMarkCheckResult {
  declared: VegMark;
  detected: VegMark;
  mismatch: boolean;
  mismatchIngredients: string[];
  message: string | null;
}

export function crossCheckVegMark(
  declaredMark: VegMark,
  ingredientNames: string[],
): VegMarkCheckResult {
  const joined = ingredientNames.join(' ').toLowerCase();

  const nonVegIngredients = MEAT_KEYWORDS.filter((kw) => joined.includes(kw));
  const detected: VegMark = nonVegIngredients.length > 0 ? 'non-veg' : 'veg';

  const mismatch =
    declaredMark !== 'unknown' &&
    declaredMark !== detected;

  return {
    declared: declaredMark,
    detected,
    mismatch,
    mismatchIngredients: mismatch ? nonVegIngredients : [],
    message: mismatch
      ? `Label declares "${declaredMark}" (${_markSymbol(declaredMark)}) but ingredient list contains non-vegetarian ingredients: ${nonVegIngredients.slice(0, 3).join(', ')}. ` +
        `FSSAI requires the correct veg/non-veg mark. This may indicate a labelling error.`
      : null,
  };
}

function _markSymbol(mark: VegMark): string {
  return mark === 'veg' ? '🟢 green dot' : mark === 'non-veg' ? '🟤 brown dot' : 'unknown';
}

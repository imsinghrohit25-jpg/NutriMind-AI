// Allergen detector — pure function, no side effects.
// Scans ingredient names and raw product text for allergen keyword matches.
// Fail-safe: ambiguous ingredient text triggers 'possible' warnings.

import { ALLERGEN_TAXONOMY, AllergenId, AllergenDefinition } from './taxonomy.js';

export interface AllergenMatch {
  allergenId: AllergenId;
  displayName: string;
  matchType: 'declared' | 'trace' | 'possible';  // 'possible' = ambiguous/may-contain language
  matchedKeyword: string;
  unsuppressible: boolean;  // true when matchType is 'declared' or 'trace'
}

export interface AllergenDetectionResult {
  matches: AllergenMatch[];
  hasAnyAllergen: boolean;
  hasDeclaredAllergen: boolean;
  hasTraceAllergen: boolean;
  hasPossibleAllergen: boolean;
}

// Phrases in raw label text that indicate possible cross-contamination even without
// a specific allergen named
const AMBIGUOUS_FACILITY_PHRASES = [
  'manufactured in a facility',
  'processed in a facility',
  'made on equipment',
  'may contain traces',
  'may contain',
];

export function detectAllergens(
  ingredientNames: string[],
  rawLabelText: string,
  profileAllergens: AllergenId[],
): AllergenDetectionResult {
  const joined = ingredientNames.join(' ').toLowerCase();
  const rawText = rawLabelText.toLowerCase();

  const matches: AllergenMatch[] = [];
  const seen = new Set<`${AllergenId}:${'declared' | 'trace' | 'possible'}`>();

  const allegensToCheck =
    profileAllergens.length > 0
      ? ALLERGEN_TAXONOMY.filter((a) => profileAllergens.includes(a.id))
      : ALLERGEN_TAXONOMY;

  for (const allergen of allegensToCheck) {
    // 1. Declared (ingredient list)
    const declaredKw = findKeyword(allergen.keywords, joined);
    if (declaredKw) {
      const key = `${allergen.id}:declared` as const;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({
          allergenId: allergen.id,
          displayName: allergen.displayName,
          matchType: 'declared',
          matchedKeyword: declaredKw,
          unsuppressible: true,
        });
      }
    }

    // 2. Trace (raw label text — "may contain peanut" etc.)
    const traceKw = findKeyword(allergen.traceKeywords, rawText);
    if (traceKw) {
      const key = `${allergen.id}:trace` as const;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({
          allergenId: allergen.id,
          displayName: allergen.displayName,
          matchType: 'trace',
          matchedKeyword: traceKw,
          unsuppressible: true,
        });
      }
    }

    // 3. Possible — ambiguous facility language present but no specific allergen named
    const hasAmbiguous = AMBIGUOUS_FACILITY_PHRASES.some((p) => rawText.includes(p));
    if (hasAmbiguous && !declaredKw && !traceKw) {
      const key = `${allergen.id}:possible` as const;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({
          allergenId: allergen.id,
          displayName: allergen.displayName,
          matchType: 'possible',
          matchedKeyword: 'facility cross-contamination language',
          unsuppressible: false,  // possible warnings can be dismissed
        });
      }
    }
  }

  return {
    matches,
    hasAnyAllergen:       matches.length > 0,
    hasDeclaredAllergen:  matches.some((m) => m.matchType === 'declared'),
    hasTraceAllergen:     matches.some((m) => m.matchType === 'trace'),
    hasPossibleAllergen:  matches.some((m) => m.matchType === 'possible'),
  };
}

function findKeyword(keywords: readonly string[], text: string): string | null {
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

// Convenience: detect for a single allergen with a specific ingredient list
export function hasAllergen(
  allergenId: AllergenId,
  definition: AllergenDefinition,
  ingredientNames: string[],
  rawText: string,
): boolean {
  const joined = ingredientNames.join(' ').toLowerCase();
  const text   = rawText.toLowerCase();
  return (
    findKeyword(definition.keywords, joined) !== null ||
    findKeyword(definition.traceKeywords, text) !== null
  );
}

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cache of compiled negation patterns — one per distinct keyword across every call, since the
 *  same ~14-allergen taxonomy is reused for every product resolved. */
const _negationPatternCache = new Map<string, RegExp>();
function negationPatternFor(keyword: string): RegExp {
  let pattern = _negationPatternCache.get(keyword);
  if (!pattern) {
    // "gluten free" / "gluten-free" / "gluten - free" is a declaration of ABSENCE, not presence —
    // matching the bare keyword there produced a real, confirmed false "Contains Gluten" warning
    // on a genuinely gluten-free product (found via live verification, premium redesign Phase 3).
    // Guarded generically for every keyword (not just gluten), since the same "X free"/"X-free"
    // claim pattern applies to any allergen ("nut-free", "dairy free", etc).
    pattern = new RegExp(`${escapeRegExp(keyword)}\\s*-?\\s*free\\b`, 'gi');
    _negationPatternCache.set(keyword, pattern);
  }
  return pattern;
}

function findKeyword(keywords: readonly string[], text: string): string | null {
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    // Strip only the negated occurrences ("<keyword> free") before checking — a product whose
    // text contains the keyword BOTH as a genuine ingredient AND as an unrelated "free" claim
    // elsewhere must still match on the genuine occurrence.
    const withoutNegations = text.replace(negationPatternFor(lower), '');
    if (withoutNegations.includes(lower)) return kw;
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

// NOVA group classifier — pure function, no LLM, no side effects.
// Monteiro et al. 2019 (NOVA classification), adapted for India.
// Returns the NOVA group (1–4) inferred from ingredient list heuristics.
//
// This is a best-effort classifier; the score engine uses it as one input.
// The NOVA group can also be set explicitly from product data (e.g., OpenFoodFacts).

export type NovaGroup = 1 | 2 | 3 | 4;

export interface NovaResult {
  group: NovaGroup;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// Additives whose INS numbers signal ultra-processing (NOVA 4)
// Includes stabilisers, emulsifiers, artificial flavours, colour fixes, bleaching agents.
const NOVA4_INS_SIGNALS = new Set([
  'e102', 'e110', 'e122', 'e129', 'e133',    // artificial colours
  'e200', 'e202', 'e211', 'e212', 'e221',    // preservatives
  'e320', 'e321',                             // antioxidants (BHA, BHT)
  'e407', 'e412', 'e415', 'e460',            // thickeners/stabilisers
  'e471', 'e472', 'e481', 'e482',            // emulsifiers
  'e621', 'e627', 'e631',                    // flavour enhancers (MSG, etc.)
  'e951', 'e952', 'e955',                    // artificial sweeteners
]);

// Keyword signals in ingredient text for NOVA 4
const NOVA4_KEYWORD_SIGNALS = [
  'artificial flavour', 'artificial flavor', 'artificial colour', 'artificial color',
  'artificial sweetener', 'high fructose corn syrup', 'hfcs',
  'hydrolyzed', 'hydrolysed', 'maltodextrin', 'modified starch',
  'soy protein isolate', 'whey protein concentrate', 'sodium caseinate',
  'interesterified', 'fractionated', 'deodorised', 'defatted',
];

// Signals for NOVA 3 (processed but not ultra)
const NOVA3_KEYWORD_SIGNALS = [
  'salt', 'sugar', 'vinegar', 'oil', 'brine',
  'smoked', 'cured', 'fermented',
];

export function classifyNova(
  ingredientNames: string[],
  novaGroupOverride?: number,
): NovaResult {
  // Explicit NOVA group from product database (highest confidence)
  if (novaGroupOverride != null) {
    const group = Math.min(4, Math.max(1, Math.round(novaGroupOverride))) as NovaGroup;
    return {
      group,
      confidence: 'high',
      reason: `NOVA group ${group} from product database`,
    };
  }

  if (ingredientNames.length === 0) {
    return { group: 3, confidence: 'low', reason: 'No ingredients available; defaulting to NOVA 3' };
  }

  const joined = ingredientNames.join(' ').toLowerCase();

  // Check for NOVA 4 INS codes in ingredient text
  for (const ins of NOVA4_INS_SIGNALS) {
    if (joined.includes(ins)) {
      return {
        group: 4,
        confidence: 'medium',
        reason: `Ultra-processing additive detected (${ins.toUpperCase()})`,
      };
    }
  }

  // Check for NOVA 4 keyword signals
  for (const kw of NOVA4_KEYWORD_SIGNALS) {
    if (joined.includes(kw)) {
      return {
        group: 4,
        confidence: 'medium',
        reason: `Ultra-processing keyword detected ("${kw}")`,
      };
    }
  }

  // Single ingredient → NOVA 1
  if (ingredientNames.length === 1) {
    return { group: 1, confidence: 'high', reason: 'Single ingredient — minimally processed' };
  }

  // Check for NOVA 3 signals
  const nova3Hit = NOVA3_KEYWORD_SIGNALS.find((kw) => joined.includes(kw));
  if (nova3Hit) {
    return {
      group: 3,
      confidence: 'low',
      reason: `Processing ingredient detected ("${nova3Hit}"); classified as processed (NOVA 3)`,
    };
  }

  // Default: NOVA 2 for multi-ingredient culinary products
  return {
    group: 2,
    confidence: 'low',
    reason: 'Multi-ingredient, no ultra-processing signals detected — likely processed culinary ingredient (NOVA 2)',
  };
}

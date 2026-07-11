// AI label enrichment — Gemini integration, flag `global.p14.gemini_label_enrichment` (default off).
//
// Deterministic dataset matching (resolveByName against IFCT/CoFID/USDA/OFF via the existing
// country waterfall) ALWAYS runs first, in the route handler, before this module is ever called.
// This module never resolves nutrition itself — it receives the already-matched product's
// citation (or null, if nothing matched) purely as read-only context to hand to the model.
//
// Determinism boundary: this module identifies/disambiguates/explains — it NEVER computes or
// emits a nutrition number. The response schema below has no numeric-nutrition fields at all, and
// `stripDisallowedNutritionKeys` additionally strips any such key defensively if the model ever
// includes one anyway (belt-and-suspenders, same "prefer a fail-safe over a fabricated value"
// discipline as gateway/pii-redaction.ts and the allergen fail-safe). Allergen mentions returned
// here are candidate flags only, extracted from label text — the real safety decision is made
// exclusively by the existing allergenCheckTool (agents/tools/allergen.ts); nothing here can
// block or allow a food.
//
// Graceful degradation: any failure (gateway unavailable, network error, malformed JSON, safety
// block) returns `available: false` with an honest note — never a silent fallback, never a thrown
// error that would break the deterministic parse the caller already has in hand.

import type { GatewayRouter } from '../../gateway/router.js';
import type { NutritionCitation } from '../../nutrition/citation.js';
import type { ParsedLabel } from './parser.js';

const NUTRITION_NUMBER_KEYS = new Set([
  'energyKcal', 'energyKj', 'proteinG', 'fatTotalG', 'fatSaturatedG', 'fatTransG',
  'fatPolyunsaturatedG', 'fatMonounsaturatedG', 'carbohydratesG', 'sugarsG', 'sugarsAddedG',
  'dietaryFiberG', 'sodiumMg', 'cholesterolMg', 'calciumMg', 'ironMg', 'potassiumMg', 'zincMg',
  'vitaminCMg', 'vitaminAIu', 'vitaminDIu', 'vitaminB12Mcg', 'folateMcg',
]);

const ENRICHMENT_SYSTEM_PROMPT = `You are a food-label interpretation assistant. You are given a
photo of a packaged food label, the raw OCR text already extracted from it, and — when available —
a nutrition record already matched to it from a verified dataset (with citation).

Your job is ONLY to:
1. Identify/disambiguate the food name and brand as printed on the label.
2. Interpret the ingredient list in plain language for the user's locale.
3. Extract CANDIDATE allergen mentions from the label text (words/phrases only) — you are not
   making a safety decision, just surfacing what the label text mentions.
4. Interpret serving-size context printed on the label (e.g. "serves 4", "resealable pack").
5. Write a short, plain-language explanation of the food for the user.

You must NEVER state, estimate, or restate any nutrition number (calories, grams, mg, %DV, or any
other measured value) — a verified dataset owns every number. If given a matched citation, treat
its numbers as authoritative and do not repeat, alter, or contradict them.

Return ONLY valid JSON in this exact shape:
{
  "foodName": <string|null>,
  "brandGuess": <string|null>,
  "ingredientInterpretation": <string|null>,
  "allergenCandidates": <string[]>,
  "servingContextNote": <string|null>,
  "explanation": <string|null>,
  "confidence": <0.0-1.0>
}

Rules:
- Use null for anything you cannot determine from the label — never guess.
- allergenCandidates lists only allergen words/phrases actually printed on the label (e.g. "milk",
  "may contain nuts") — an empty array if none are mentioned.
- confidence reflects how legible and complete the label was.`;

export interface LabelEnrichmentResult {
  available: boolean;
  aiEnriched: boolean;
  foodName: string | null;
  brandGuess: string | null;
  ingredientInterpretation: string | null;
  allergenCandidates: string[];
  servingContextNote: string | null;
  explanation: string | null;
  confidence: number;
  note: string | null;
}

interface RawEnrichment {
  foodName?: string | null;
  brandGuess?: string | null;
  ingredientInterpretation?: string | null;
  allergenCandidates?: unknown;
  servingContextNote?: string | null;
  explanation?: string | null;
  confidence?: number;
  [key: string]: unknown; // deliberately loose — stripDisallowedNutritionKeys audits this
}

function unavailable(note: string): LabelEnrichmentResult {
  return {
    available: false,
    aiEnriched: false,
    foodName: null,
    brandGuess: null,
    ingredientInterpretation: null,
    allergenCandidates: [],
    servingContextNote: null,
    explanation: null,
    confidence: 0,
    note,
  };
}

/** Defensive determinism-boundary check: drops any key that looks like a nutrition number the
 *  model tried to introduce despite the system prompt. Returns the keys it had to drop (empty in
 *  the overwhelming common case) so the caller can log it — this should never happen in practice. */
function stripDisallowedNutritionKeys(raw: RawEnrichment): string[] {
  const dropped: string[] = [];
  for (const key of Object.keys(raw)) {
    if (NUTRITION_NUMBER_KEYS.has(key)) {
      dropped.push(key);
      delete raw[key];
    }
  }
  return dropped;
}

export async function enrichLabelWithGemini(opts: {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  ocrText: string;
  parsedLabel: ParsedLabel;
  citation: NutritionCitation | null;
  matchedProductName: string | null;
  locale: string;
  gateway: GatewayRouter;
  traceId: string;
}): Promise<LabelEnrichmentResult> {
  const { imageBase64, imageMediaType, ocrText, parsedLabel, citation, matchedProductName, locale, gateway, traceId } = opts;

  const matchedContext = citation
    ? `A dataset match was already found: "${matchedProductName ?? 'unknown name'}" ` +
      `(source: ${citation.sourceDisplay}, dataset version ${citation.datasetVersion}). ` +
      `Treat its nutrition numbers as authoritative; do not restate them.`
    : 'No dataset match was found for this label — there is no authoritative nutrition record yet.';

  const userMessage = [
    `OCR text extracted from the label:\n${ocrText}`,
    matchedContext,
    `Fields the deterministic parser was unsure about: ${parsedLabel.lowConfidenceFields.join(', ') || 'none'}.`,
    `Respond in a way appropriate for locale: ${locale}.`,
  ].join('\n\n');

  let response;
  try {
    response = await gateway.complete({
      tier: 'vision_analysis',
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      images: [{ mimeType: imageMediaType, data: imageBase64 }],
      traceId,
      maxTokens: 500,
      temperature: 0,
    });
  } catch {
    return unavailable('AI enrichment unavailable — the gateway call failed.');
  }

  let raw: RawEnrichment;
  try {
    const text = response.content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    raw = JSON.parse(text) as RawEnrichment;
  } catch {
    return unavailable('AI enrichment unavailable — the model response was not valid JSON.');
  }

  stripDisallowedNutritionKeys(raw);

  const allergenCandidates = Array.isArray(raw.allergenCandidates)
    ? raw.allergenCandidates.filter((a): a is string => typeof a === 'string')
    : [];

  return {
    available: true,
    aiEnriched: true,
    foodName: raw.foodName ?? null,
    brandGuess: raw.brandGuess ?? null,
    ingredientInterpretation: raw.ingredientInterpretation ?? null,
    allergenCandidates,
    servingContextNote: raw.servingContextNote ?? null,
    explanation: raw.explanation ?? null,
    confidence: Math.min(1, Math.max(0, raw.confidence ?? 0)),
    note: null,
  };
}

/** First non-empty line of the OCR text, used as a search-query heuristic for dataset matching —
 *  `ParsedLabel` has no dedicated product-name field, so this is the same heuristic a human
 *  skimming the label would use (the product name is printed first, before nutrition tables). */
export function extractSearchQueryHeuristic(ocrText: string): string | null {
  for (const line of ocrText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length >= 3) return trimmed;
  }
  return null;
}

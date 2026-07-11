// Nutrition Agent — Phase 13 (§16.4.1). Flow: food.lookup/food.search -> nutrition.compute ->
// (optional) alternatives.rank -> explain. Quotes computed numbers only (the explain step embeds
// the real tool results as the template the LLM/fallback phrases — never invents one); states
// the data quality grade when C/D.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { GlobalResolutionResult as ResolutionResult } from '../../resolution/country-waterfall.js';
import type { NutritionComputeOutput } from '../tools/nutrition.js';
import type { AllergenRecheckInput } from '../output-guard.js';
import { explainWithFallback } from '../explain.js';

/** Very small, real (not invented) extraction: a barcode is a 6+ digit run; otherwise treat the
 *  remainder of the message (minus a few filler question words) as a food-name search query.
 *  No NLU model here — matches this codebase's "derived, never divined" discipline: better to
 *  under-extract than guess at parameters the user didn't structurally provide. */
function extractFoodQuery(message: string): { barcode: string } | { foodName: string } {
  const barcodeMatch = /\b(\d{6,14})\b/.exec(message);
  if (barcodeMatch) return { barcode: barcodeMatch[1]! };

  const cleaned = message
    .replace(/\b(kitna|kitne|hai|isme|is me|me|what|is|the|how much|does|have|in)\b/gi, ' ')
    .replace(/[?।.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { foodName: cleaned || message.trim() };
}

function buildTemplate(product: ResolutionResult['product'], nutrition: NutritionComputeOutput): string {
  if (!product || !nutrition.per100g) {
    return `I couldn't find nutrition data for that item.`;
  }
  const lines = [`${product.name}${product.brand ? ` (${product.brand})` : ''}:`];
  if (nutrition.score) {
    lines.push(`Health score: ${nutrition.score.score}/100 (${nutrition.score.band}).`);
  }
  const n = nutrition.per100g;
  lines.push(
    `Per 100g: ${n.energyKcal ?? '—'}kcal, ${n.proteinG ?? '—'}g protein, ` +
    `${n.sodiumMg ?? '—'}mg sodium, ${n.sugarsG ?? '—'}g sugar.`,
  );
  if (nutrition.dataQualityGrade === 'C' || nutrition.dataQualityGrade === 'D') {
    lines.push(`Note: data quality grade ${nutrition.dataQualityGrade} — some values are estimated.`);
  }
  return lines.join(' ');
}

export const runNutritionAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('nutrition', input.registry, input.ctx);
  const query = extractFoodQuery(input.message);

  const resolution = 'barcode' in query
    ? await call<{ barcode: string }, ResolutionResult>('food.lookup', query)
    : await call<{ name: string }, ResolutionResult>('food.search', { name: query.foodName });

  if (!resolution.product) {
    return {
      responseText: `I couldn't find that product in our database. It's been queued for review.`,
      toolTrace: trace,
    };
  }

  const nutrition = await call<{ product: typeof resolution.product }, NutritionComputeOutput>(
    'nutrition.compute', { product: resolution.product },
  );

  let allergenRecheckInput: AllergenRecheckInput | undefined;
  const profile = await call<Record<string, never>, { allergens: string[]; displayName: string }>('user.profile', {});
  if (profile.allergens.length > 0 && resolution.product.ingredientsRawText) {
    allergenRecheckInput = {
      ingredientNames: [resolution.product.ingredientsRawText],
      rawLabelText: resolution.product.ingredientsRawText,
      members: [{ memberId: input.ctx.userId, memberName: profile.displayName, allergens: profile.allergens as never }],
    };
  }

  const template = buildTemplate(resolution.product, nutrition);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt: 'You are a nutrition assistant. Explain the given product data conversationally. Never invent numbers.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return {
    responseText,
    toolTrace: trace,
    allergenRecheckInput,
    handoffState: { lastProductId: resolution.productId },
  };
};

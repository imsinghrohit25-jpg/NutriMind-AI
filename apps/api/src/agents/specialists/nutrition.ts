// Nutrition Agent — Phase 13 (§16.4.1), upgraded to clinical-team-grade personalization (AI
// Nutrition Intelligence upgrade). Flow: food.lookup/food.search -> nutrition.compute ->
// (optional) alternatives.rank -> explain. Quotes computed numbers only (the explain step embeds
// the real tool results as the template the LLM/fallback phrases — never invents one); states
// the data quality grade when C/D.
//
// The upgrade adds a personalization pass shared by BOTH the general-advice and product-explain
// paths: user.profile + memory.facts are now always fetched, engine-computed TDEE/macro targets
// and cited disease guidance (engines/disease) are folded into the grounding text, and every
// response ends with one deterministic follow-up question — all built in
// agents/personalization-context.ts and agents/meal-suggestions.ts so it survives even when no
// LLM is configured (explainWithFallback's template path), not just when one is.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { FoodResolutionResult as ResolutionResult } from '../tools/food.js';
import type { NutritionComputeOutput } from '../tools/nutrition.js';
import type { UserProfileOutput, UserGoalsOutput } from '../tools/user.js';
import type { AllergenRecheckInput } from '../output-guard.js';
import type { StoredMemoryFact } from '../../memory/facts-service.js';
import { evaluateDiseaseRules } from '../../engines/disease/index.js';
import {
  buildPersonalizationBlock,
  buildFollowUpQuestion,
  type PersonalizationBlock,
} from '../personalization-context.js';
import {
  detectMealType,
  detectGoal,
  selectMealSuggestions,
  renderSuggestions,
  type SuggestionDietType,
} from '../meal-suggestions.js';
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

/** A message asking for general dietary advice/recommendations ("what should I eat for
 *  breakfast to get more protein") is not a lookup of one specific product — but
 *  `extractFoodQuery` above has no NLU and can't tell the difference, so without this check it
 *  strips a few stopwords and hands the leftover words (e.g. "eat breakfast get protein") to
 *  food.search as if it were a product name. That resolves to whatever product happens to
 *  fuzzy-match those leftover words (found on a real device: an unrelated cereal, every time,
 *  regardless of what the user actually asked), and the LLM then dutifully explains that
 *  product's data instead of answering the real question. Recognizing this phrasing up front and
 *  routing straight to a conversational answer — instead of pinning it to one irrelevant
 *  product's numbers — is a much smaller, safer fix than teaching the extractor real NLU. */
const ADVICE_QUESTION_RE =
  /\b(what should|which foods?|recommend|suggest|best (food|foods|meal|meals|way)|good sources? of|how (can|do) i (get|increase|reduce|eat))\b/i;

function isGeneralAdviceQuestion(message: string): boolean {
  return ADVICE_QUESTION_RE.test(message);
}

async function fetchPersonalization(
  call: ReturnType<typeof makeAgentToolCaller>['call'],
): Promise<{ profile: UserProfileOutput; personalization: PersonalizationBlock }> {
  const profile = await call<Record<string, never>, UserProfileOutput>('user.profile', {});
  let memoryFacts: StoredMemoryFact[] = [];
  try {
    memoryFacts = await call<{ sections: string[] }, StoredMemoryFact[]>('memory.facts', {
      sections: ['health_goal', 'eating_pattern', 'user_habit', 'regional_cuisine_affinity', 'seasonal_pattern'],
    });
  } catch {
    // Memory recall is a personalization enhancement, not a requirement — the chat must still
    // answer correctly (just less personally) if the memory system is unavailable.
  }
  let goals: UserGoalsOutput | null = null;
  try {
    goals = await call<Record<string, never>, UserGoalsOutput>('user.goals', {});
  } catch {
    // Falls back to deriving targets from raw profile fields inside buildPersonalizationBlock.
  }
  const personalization = buildPersonalizationBlock({ profile, goals, memoryFacts });
  return { profile, personalization };
}

function buildGeneralAdviceTemplate(
  message: string,
  personalization: PersonalizationBlock,
  dietType: SuggestionDietType | null,
  allergens: string[],
  budgetLevel: string | null,
): string {
  const mealType = detectMealType(message);
  const goal = detectGoal(message);
  const suggestions = selectMealSuggestions({ mealType, dietType, allergens, count: 4, budgetLevel });

  const parts: string[] = [];
  if (mealType) {
    parts.push(
      `For ${mealType}${goal !== 'general' ? ` with a ${goal.replace('_', ' ')} focus` : ''}, here are a few real options:`,
    );
  } else {
    parts.push(`Here are a few real options${goal !== 'general' ? ` with a ${goal.replace('_', ' ')} focus` : ''}:`);
  }
  parts.push(renderSuggestions(suggestions, goal));

  if (personalization.targets) {
    parts.push(
      `Given your profile, aim for roughly ${personalization.targets.budget.proteinG}g protein and ` +
      `~${personalization.targets.tdeeKcal} kcal across the whole day, not just this one meal.`,
    );
  }
  if (personalization.conditionHighlights.length > 0) {
    parts.push(`Keeping your health conditions in mind: ${personalization.conditionHighlights.join(' ')}`);
  }
  return parts.join('\n');
}

function buildProductTemplate(
  product: ResolutionResult['product'],
  nutrition: NutritionComputeOutput,
  diseaseNotes: string[],
): string {
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
  if (diseaseNotes.length > 0) {
    lines.push(`For your health profile: ${diseaseNotes.join(' ')}`);
  }
  return lines.join(' ');
}

export const runNutritionAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('nutrition', input.registry, input.ctx);
  const query = extractFoodQuery(input.message);

  if (!('barcode' in query) && isGeneralAdviceQuestion(input.message)) {
    const { profile, personalization } = await fetchPersonalization(call);
    const dietType = (profile.dietType as SuggestionDietType | null) ?? null;
    const template = buildGeneralAdviceTemplate(input.message, personalization, dietType, profile.allergens, profile.budgetLevel);

    const responseText = await explainWithFallback({
      gateway: input.ctx.gateway,
      systemPrompt:
        'You are part of a multidisciplinary clinical nutrition team (registered dietitian, ' +
        'diabetes educator, sports nutrition specialist, weight-management coach). Answer the ' +
        'general dietary question personally and scientifically, using the real user profile, ' +
        'targets, and food suggestions given below as grounding. Explain WHY each suggestion fits ' +
        'the user\'s goal and profile — never just list foods with no reasoning. Do not state ' +
        'specific per-100g nutrition numbers for a product — you have no product looked up to ' +
        'ground them in. Keep it to 3-5 sentences of prose plus the suggestions, never one line.',
      userMessage: input.message,
      templateFallback: template,
      locale: input.locale,
    });

    const followUp = buildFollowUpQuestion(profile, personalization.targets);
    return { responseText: `${responseText}\n\n${followUp}`, toolTrace: trace };
  }

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

  const { profile, personalization } = await fetchPersonalization(call);

  let allergenRecheckInput: AllergenRecheckInput | undefined;
  if (profile.allergens.length > 0 && resolution.product.ingredientsRawText) {
    allergenRecheckInput = {
      ingredientNames: [resolution.product.ingredientsRawText],
      rawLabelText: resolution.product.ingredientsRawText,
      members: [{ memberId: input.ctx.userId, memberName: profile.displayName, allergens: profile.allergens as never }],
    };
  }

  const diseaseEvals = (profile.conditions.length > 0 || profile.reproductiveStatus) && nutrition.per100g
    ? evaluateDiseaseRules({
        nutrition: nutrition.per100g,
        ingredientsText: resolution.product.ingredientsRawText,
        conditions: profile.conditions,
        medications: profile.medications,
        reproductiveStatus: profile.reproductiveStatus,
      }).filter((e) => e.triggered)
    : [];
  const diseaseNotes = diseaseEvals.map((e) => e.message).filter((m): m is string => m !== null);

  const template = buildProductTemplate(resolution.product, nutrition, diseaseNotes);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt:
      'You are part of a multidisciplinary clinical nutrition team. Explain the given product ' +
      'data conversationally and scientifically — state whether it fits the user\'s daily targets ' +
      'and any health conditions on file, and why. Never invent numbers; only use the ones given.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  const followUp = buildFollowUpQuestion(profile, personalization.targets);

  return {
    responseText: `${responseText}\n\n${followUp}`,
    toolTrace: trace,
    allergenRecheckInput,
    handoffState: { lastProductId: resolution.productId },
  };
};

// Restaurant Agent — Phase 13 (§16.4.4). Flow: ocr.process(menu) -> restaurant.lookup per item
// (provenance or ESTIMATED, always flagged) -> allergen.check on the recommended item ->
// alternatives.rank across scored items -> recommend with calories/allergen flags, uncertainty
// stated for estimated items.

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import type { OcrProcessOutput } from '../tools/ocr.js';
import type { RestaurantLookupOutput } from '../tools/restaurant.js';
import type { RankableCandidate } from '../../memory/ranker.js';
import type { MenuItem } from '../../restaurant/menu-scanner.js';
import type { AllergenRecheckInput } from '../output-guard.js';
import { explainWithFallback } from '../explain.js';

function buildTemplate(
  scored: Array<{ item: MenuItem; lookup: RestaurantLookupOutput }>,
  ranked: RankableCandidate[],
): string {
  if (scored.length === 0) return `I couldn't read any items from that menu.`;

  const bestId = ranked[0]?.id;
  const best = scored.find((s) => s.item.name === bestId);
  if (!best) return `Found ${scored.length} menu items, but none matched your dietary preferences.`;

  const nutrition = best.lookup.nutrition;
  const kcalLine = nutrition.source === 'chain_disclosure'
    ? `${nutrition.data.energy_kcal ?? '—'}kcal (official disclosure)`
    : `~${nutrition.data.nutrients.calories ?? '—'}kcal (estimated, confidence ${nutrition.data.confidence})`;

  const lines = [`Best match: ${best.item.name} — ${kcalLine}.`];
  if (best.lookup.scoring.warnings.length > 0) {
    lines.push(`Note: ${best.lookup.scoring.warnings.join('; ')}.`);
  }
  return lines.join(' ');
}

export const runRestaurantAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('restaurant', input.registry, input.ctx);

  if (!input.ctx.gateway) {
    return {
      responseText: `Reading a menu needs the AI vision/parsing gateway, which isn't configured in this environment.`,
      toolTrace: trace,
    };
  }

  const menuText = (input.handoffState.menuText as string | undefined) ?? input.message;
  const scan = await call<{ docType: 'menu'; rawText: string }, OcrProcessOutput>('ocr.process', {
    docType: 'menu', rawText: menuText,
  });
  const menuResult = scan.docType === 'menu' ? scan.result : { items: [], confidence: 0 };

  if (menuResult.items.length === 0) {
    return { responseText: `I couldn't read any items from that menu.`, toolTrace: trace };
  }

  const profile = await call<Record<string, never>, { dietType: string | null; allergens: string[]; displayName: string }>(
    'user.profile', {},
  );
  const isVegPreference = profile.dietType === 'vegetarian' || profile.dietType === 'vegan' || profile.dietType === 'jain';

  const scored: Array<{ item: MenuItem; lookup: RestaurantLookupOutput }> = [];
  for (const item of menuResult.items) {
    const lookup = await call<Parameters<typeof call>[1], RestaurantLookupOutput>('restaurant.lookup', {
      item, userSodiumGoalMg: 2000, isVegPreference, allergens: profile.allergens,
    } as never);
    scored.push({ item, lookup });
  }

  const candidates: RankableCandidate[] = scored
    .filter((s) => s.lookup.scoring.suitable)
    .map((s) => ({ id: s.item.name, cuisine: menuResult.cuisine }));
  const ranked = candidates.length > 0
    ? await call<{ candidates: RankableCandidate[] }, RankableCandidate[]>('alternatives.rank', { candidates })
    : [];

  let allergenRecheckInput: AllergenRecheckInput | undefined;
  const bestId = ranked[0]?.id;
  const best = scored.find((s) => s.item.name === bestId);
  if (best?.item.ingredients && best.item.ingredients.length > 0 && profile.allergens.length > 0) {
    allergenRecheckInput = {
      ingredientNames: best.item.ingredients,
      rawLabelText: best.item.ingredients.join(', '),
      members: [{ memberId: input.ctx.userId, memberName: profile.displayName, allergens: profile.allergens as never }],
    };
  }

  const template = buildTemplate(scored, ranked);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt: 'You are a restaurant/dining assistant. Recommend from the given scored menu items conversationally. State when a figure is an estimate, never invent one.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return { responseText, toolTrace: trace, allergenRecheckInput };
};

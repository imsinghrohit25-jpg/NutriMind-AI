// Travel Nutrition Agent — Phase 13 (§16.4.7). Flow: country.transition (confirmed, never
// silent per Phase 1 UX) -> the resolved CountryProfile drives local cuisine-standard/allergen-
// regime context; home-country goals remain active (this agent never touches user.goals — it
// only layers country context, matching the addendum's "Home-country goals remain active").

import type { SpecialistAgentRunner } from '../agent-runner.js';
import { makeAgentToolCaller } from '../agent-runner.js';
import { CITY_TO_COUNTRY } from '../intent-classifier.js';
import { COUNTRY_REGISTRY } from '../../country/registry.js';
import type { CountryProfile } from '../../country/types.js';
import { explainWithFallback } from '../explain.js';

/** Same "derived, never divined" discipline as intent-classifier.ts's own gazetteer: a city or
 *  country name not in this list simply isn't detected — never guessed. */
function detectDestination(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [city, iso] of Object.entries(CITY_TO_COUNTRY)) {
    if (lower.includes(city)) return iso;
  }
  for (const profile of COUNTRY_REGISTRY.values()) {
    if (profile.isoCode !== 'GLOBAL' && lower.includes(profile.displayName.toLowerCase())) {
      return profile.isoCode;
    }
  }
  return null;
}

function buildTemplate(profile: CountryProfile): string {
  return [
    `Switched your context to ${profile.displayName}.`,
    `Local nutrition labels use the ${profile.nutritionStandard} standard.`,
    `Allergen labeling regime: ${profile.allergenRegime}.`,
    `Currency: ${profile.currencyCode}.`,
    `Your home-country goals stay active — this only adds local context on top.`,
  ].join(' ');
}

export const runTravelNutritionAgent: SpecialistAgentRunner = async (input) => {
  const { call, trace } = makeAgentToolCaller('travel_nutrition', input.registry, input.ctx);

  const targetIso = detectDestination(input.message);
  if (!targetIso) {
    return {
      responseText: `Which country are you traveling to? I can adjust nutrition labels and allergen guidance once I know.`,
      toolTrace: trace,
    };
  }

  const profile = await call<{ toIsoCode: string }, CountryProfile>('country.transition', { toIsoCode: targetIso });

  const template = buildTemplate(profile);
  const responseText = await explainWithFallback({
    gateway: input.ctx.gateway,
    systemPrompt: 'You are a travel-nutrition assistant. Explain the given country context change conversationally.',
    userMessage: input.message,
    templateFallback: template,
    locale: input.locale,
  });

  return {
    responseText,
    toolTrace: trace,
    handoffState: { newCountryIsoCode: profile.isoCode, countryProfile: profile },
  };
};

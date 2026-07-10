// country.profile / country.transition — Phase 13 (§16.3). Wraps country/registry.ts's
// lookupCountry() (profile) and onboarding/country-service.ts's setPreferredCountry() exactly as
// routes/v1/onboarding.ts already calls it (transition) — including the same memory-event
// emission, so a travel-mode switch initiated by the Travel Nutrition Agent is indistinguishable
// from one initiated through onboarding for every downstream memory/analytics consumer.

import type { ToolDefinition, ToolContext } from '../types.js';
import { lookupCountry, lookupCountryOrGlobal } from '../../country/registry.js';
import type { CountryProfile } from '../../country/types.js';
import { setPreferredCountry, UnknownCountryError } from '../../onboarding/country-service.js';
import { recordEventBestEffort } from '../../memory/events.js';

export interface CountryProfileInput {
  isoCode: string;
}

export const countryProfileTool: ToolDefinition<CountryProfileInput, CountryProfile> = {
  name: 'country.profile',
  description: 'Look up the full CountryProfile (cuisine, nutrition standard, allergen regime, grocery/restaurant sources) for an ISO country code.',
  execute: async (input) => {
    const profile = lookupCountry(input.isoCode);
    if (!profile) throw new UnknownCountryError(input.isoCode);
    return profile;
  },
};

export interface CountryTransitionInput {
  toIsoCode: string;
  fromIsoCode?: string;
}

export const countryTransitionTool: ToolDefinition<CountryTransitionInput, CountryProfile> = {
  name: 'country.transition',
  description: 'Confirm a travel-mode country transition (never silent — this persists the change and emits a country_transition memory event, same as the onboarding flow).',
  execute: async (input, ctx) => {
    const profile = await setPreferredCountry(
      ctx.supabase, ctx.userId, input.toIsoCode, input.fromIsoCode ?? input.toIsoCode,
    );

    recordEventBestEffort(ctx.supabase, ctx.userId, 'country_transition', {
      fromIsoCode: input.fromIsoCode,
      toIsoCode: input.toIsoCode,
    });

    return profile;
  },
};

export { lookupCountryOrGlobal };

// Country onboarding v2 — Phase 10 (`global.p10.country_onboarding_v2`).
// Wires migration 0018's `preferred_country`/`detected_country` columns (added to
// `users_profiles`, fixed to the real table name in Phase 9's route-registration audit — see
// ADR-0022) to an actual read/write path for the first time. Closes the loop the Dart
// `CountryResolutionChain`'s doc comment already described (Step 2: "API profile
// preferred_country, loaded at startup") but that nothing ever populated.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CountryProfile } from '../country/types.js';
import { COUNTRY_REGISTRY, lookupCountry } from '../country/registry.js';

export interface CountrySuggestion {
  /** The country resolved for this request via the existing 5-step header-based chain
   *  (`country/resolution-chain.ts`) — a suggestion for the onboarding UI to confirm, not yet
   *  persisted as the user's explicit preference. */
  suggested: CountryProfile;
  /** Every registered country, for the "pick a different one" list. */
  countries: CountryProfile[];
}

export class UnknownCountryError extends Error {
  constructor(isoCode: string) {
    super(`Unknown country code: ${isoCode}`);
    this.name = 'UnknownCountryError';
  }
}

export function getCountrySuggestion(resolved: CountryProfile): CountrySuggestion {
  return { suggested: resolved, countries: [...COUNTRY_REGISTRY.values()] };
}

/**
 * Persist the user's explicit country choice. `detectedIsoCode` (the auto-resolved country at
 * the time of this call) is stored alongside it — an audit trail of "what we guessed" vs.
 * "what the user picked," useful if resolution heuristics ever need retrospective tuning.
 */
export async function setPreferredCountry(
  supabase: SupabaseClient,
  userId: string,
  isoCode: string,
  detectedIsoCode: string,
): Promise<CountryProfile> {
  const profile = lookupCountry(isoCode);
  if (!profile) throw new UnknownCountryError(isoCode);

  const { error } = await supabase
    .from('users_profiles')
    .update({ preferred_country: profile.isoCode, detected_country: detectedIsoCode })
    .eq('id', userId);

  if (error) throw new Error(`setPreferredCountry: ${error.message}`);
  return profile;
}

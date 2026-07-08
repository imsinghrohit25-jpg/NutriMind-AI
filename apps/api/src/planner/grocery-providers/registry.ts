// Grocery Price Provider registry — Phase 5.
// Maps ISO country code -> GroceryPriceProvider. Adding a new country's provider requires:
// (1) add a provider file here, (2) register it below. No grocery-optimizer.ts changes needed.

import type { GroceryPriceProvider } from './types.js';
import { INDIA_GROCERY_PROVIDER } from './india.js';
import { US_GROCERY_PROVIDER } from './us.js';
import { UK_GROCERY_PROVIDER } from './uk.js';

const PROVIDERS: GroceryPriceProvider[] = [
  INDIA_GROCERY_PROVIDER,
  US_GROCERY_PROVIDER,
  UK_GROCERY_PROVIDER,
];

const BY_COUNTRY = new Map<string, GroceryPriceProvider>();
for (const provider of PROVIDERS) {
  for (const iso of provider.isoCountryCodes) {
    BY_COUNTRY.set(iso, provider);
  }
}

/**
 * Look up a grocery price provider by ISO country code. Falls back to the India provider —
 * matching pre-Phase-5 default behavior — when the country has no registered provider yet.
 */
export function getGroceryProvider(isoCode: string | null | undefined): GroceryPriceProvider {
  if (!isoCode) return INDIA_GROCERY_PROVIDER;
  return BY_COUNTRY.get(isoCode.toUpperCase()) ?? INDIA_GROCERY_PROVIDER;
}

export { INDIA_GROCERY_PROVIDER, US_GROCERY_PROVIDER, UK_GROCERY_PROVIDER };

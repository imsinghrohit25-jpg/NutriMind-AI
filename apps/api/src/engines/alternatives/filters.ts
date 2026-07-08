// Alternative filters — pure function.
// Applies availability and budget constraints to the ranked list.

import type { RankedAlternative } from './rank.js';

export interface FilterOptions {
  maxPriceRs?:          number | null;  // upper price limit (user's budget)
  requirePriceData?:    boolean;        // exclude products with no price data
  requirePositiveDelta?:boolean;        // only return alternatives with scoreDelta > 0
  maxResults?:          number;         // cap on returned alternatives
}

export function filterAlternatives(
  ranked: RankedAlternative[],
  opts: FilterOptions = {},
): RankedAlternative[] {
  let result = [...ranked];

  if (opts.requirePositiveDelta) {
    result = result.filter((r) => r.scoreDelta > 0);
  }

  if (opts.maxPriceRs != null) {
    result = result.filter(
      (r) => r.priceRs == null || r.priceRs <= opts.maxPriceRs!,
    );
  }

  if (opts.requirePriceData) {
    result = result.filter((r) => r.priceRs != null);
  }

  const max = opts.maxResults ?? 5;
  return result.slice(0, max);
}

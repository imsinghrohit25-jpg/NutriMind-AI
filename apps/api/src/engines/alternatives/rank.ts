// Alternative ranker — scores candidates by health-score delta and price delta.
// Gate requirement: delta math + budget option (or honest thin-category).

import type { AlternativeCandidate } from './retrieve.js';

export interface RankedAlternative extends AlternativeCandidate {
  scoreDelta:    number;   // alternative.healthScore − original.healthScore (positive = better)
  priceDelta:    number | null;  // alternative.priceRs − original.priceRs (negative = cheaper)
  isBudgetOption: boolean;  // scoreDelta > 0 AND priceDelta ≤ 0
  rankScore:     number;   // composite rank score for sorting
}

export interface RankResult {
  ranked:       RankedAlternative[];
  thinCategory: boolean;   // true when no alternatives with positive scoreDelta exist
  thinMessage:  string | null;
}

// Weights for rank score: delta is primary, budget bonus is secondary
const SCORE_DELTA_WEIGHT = 0.8;
const BUDGET_BONUS       = 10;   // bonus rank score for budget options

export function rankAlternatives(
  candidates: AlternativeCandidate[],
  originalHealthScore: number,
  originalPriceRs: number | null | undefined,
): RankResult {
  if (candidates.length === 0) {
    return {
      ranked: [],
      thinCategory: true,
      thinMessage: 'No alternative products found in this category in our database.',
    };
  }

  const ranked: RankedAlternative[] = candidates.map((c) => {
    const scoreDelta = Math.round((c.healthScore - originalHealthScore) * 10) / 10;

    const priceDelta =
      c.priceRs != null && originalPriceRs != null
        ? Math.round(c.priceRs - originalPriceRs)
        : null;

    const isBudgetOption = scoreDelta > 0 && (priceDelta !== null ? priceDelta <= 0 : false);

    const rankScore =
      scoreDelta * SCORE_DELTA_WEIGHT +
      (isBudgetOption ? BUDGET_BONUS : 0);

    return { ...c, scoreDelta, priceDelta, isBudgetOption, rankScore };
  });

  ranked.sort((a, b) => b.rankScore - a.rankScore);

  const hasPositiveDelta = ranked.some((r) => r.scoreDelta > 0);

  return {
    ranked,
    thinCategory: !hasPositiveDelta,
    thinMessage: hasPositiveDelta
      ? null
      : 'No better-scoring alternatives found in this category. ' +
        'All available alternatives score similarly or lower.',
  };
}

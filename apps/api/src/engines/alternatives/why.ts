// Why-is-this-better explainer — pure function, no LLM.
// Generates a plain-language reason string for each alternative recommendation.
// Uses deterministic rules (score delta, key sub-score differences) — no LLM call.

import type { RankedAlternative } from './rank.js';

export interface WhyBetter {
  headline:    string;
  reasons:     string[];
  budgetNote:  string | null;
}

export function explainWhy(alt: RankedAlternative): WhyBetter {
  const reasons: string[] = [];

  if (alt.scoreDelta > 0) {
    reasons.push(
      `Health score is ${alt.scoreDelta.toFixed(1)} points higher (${alt.healthScore.toFixed(0)}/100 vs original).`,
    );
  }

  const budgetNote =
    alt.isBudgetOption && alt.priceDelta != null
      ? `Also cheaper by ₹${Math.abs(alt.priceDelta).toFixed(0)}.`
      : alt.priceDelta != null && alt.priceDelta > 0
      ? `Note: costs ₹${alt.priceDelta.toFixed(0)} more.`
      : null;

  if (reasons.length === 0) {
    reasons.push('Similar nutritional profile at a different price point.');
  }

  return {
    headline: alt.scoreDelta > 0
      ? `${alt.name} is a healthier choice`
      : `${alt.name} is a comparable alternative`,
    reasons,
    budgetNote,
  };
}

// Cart health score — pure function.
// Scores a shopping cart as a quantity-weighted average of individual product scores.
// Gate requirement: real 8-item cart with expandable correct math.

import type { HealthScoreResult } from '../score/engine.js';
import { scoreBand, ScoreBand } from '../score/thresholds.js';

export interface CartItem {
  productId:     string;
  productName:   string;
  quantityUnits: number;          // number of units in the cart
  healthScore:   HealthScoreResult;
}

export interface CartScoreResult {
  overallScore:      number;      // 0–100 quantity-weighted average
  band:              ScoreBand;
  itemCount:         number;
  totalUnits:        number;
  items:             CartItemScore[];
  bandDistribution:  Record<ScoreBand, number>;  // count of items per band
}

export interface CartItemScore {
  productId:    string;
  productName:  string;
  quantityUnits:number;
  score:        number;
  band:         ScoreBand;
  weight:       number;    // share of total units (0–1)
  contribution: number;    // weighted contribution to overall score
}

export function scoreCart(items: CartItem[]): CartScoreResult {
  if (items.length === 0) {
    return {
      overallScore: 0,
      band: 'fair',
      itemCount: 0,
      totalUnits: 0,
      items: [],
      bandDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, bad: 0 },
    };
  }

  const totalUnits = items.reduce((sum, i) => sum + i.quantityUnits, 0);

  const itemScores: CartItemScore[] = items.map((item) => {
    const weight = totalUnits > 0 ? item.quantityUnits / totalUnits : 0;
    return {
      productId:    item.productId,
      productName:  item.productName,
      quantityUnits: item.quantityUnits,
      score:        item.healthScore.score,
      band:         item.healthScore.band,
      weight:       Math.round(weight * 1000) / 1000,
      contribution: Math.round(item.healthScore.score * weight * 10) / 10,
    };
  });

  const overallScore = Math.round(
    itemScores.reduce((sum, i) => sum + i.score * i.weight, 0) * 10,
  ) / 10;

  const bandDistribution: Record<ScoreBand, number> = {
    excellent: 0, good: 0, fair: 0, poor: 0, bad: 0,
  };
  for (const i of itemScores) {
    bandDistribution[i.band]++;
  }

  return {
    overallScore,
    band: scoreBand(overallScore),
    itemCount: items.length,
    totalUnits,
    items: itemScores,
    bandDistribution,
  };
}

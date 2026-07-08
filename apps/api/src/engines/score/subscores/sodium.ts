// Sodium sub-score — pure function, no side effects.
// Source: WHO Salt Reduction 2023; FSSAI Labelling Regulations 2022.
// Returns 0–100: 100 = very low sodium (best), 0 = very high sodium (worst).

import { SODIUM_THRESHOLDS_MG } from '../thresholds.js';
import type { NegativeNutrientThresholds } from '../standards/types.js';

export interface SodiumSubScore {
  score: number;       // 0–100
  sodiumMg: number;
  level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  notes: string;
}

export function scoreSodium(
  sodiumMg: number | null | undefined,
  thresholds: NegativeNutrientThresholds = SODIUM_THRESHOLDS_MG,
): SodiumSubScore {
  if (sodiumMg === null || sodiumMg === undefined) {
    return {
      score: 50,  // neutral when unknown
      sodiumMg: 0,
      level: 'moderate',
      notes: 'Sodium unknown; neutral score applied',
    };
  }

  const t = thresholds;

  let score: number;
  let level: SodiumSubScore['level'];

  if (sodiumMg <= t.veryLow) {
    score = 100;
    level = 'very_low';
  } else if (sodiumMg <= t.low) {
    score = 85;
    level = 'low';
  } else if (sodiumMg <= t.moderate) {
    // Linear interpolation between low (85) and moderate (50)
    score = 85 - ((sodiumMg - t.low) / (t.moderate - t.low)) * 35;
    level = 'moderate';
  } else if (sodiumMg <= t.high) {
    // Linear interpolation between moderate (50) and high (20)
    score = 50 - ((sodiumMg - t.moderate) / (t.high - t.moderate)) * 30;
    level = 'high';
  } else if (sodiumMg <= t.veryHigh) {
    // Linear interpolation between high (20) and very-high (0)
    score = 20 - ((sodiumMg - t.high) / (t.veryHigh - t.high)) * 20;
    level = 'very_high';
  } else {
    score = 0;
    level = 'very_high';
  }

  const notes = buildSodiumNote(sodiumMg, level);

  return { score: Math.round(score * 10) / 10, sodiumMg, level, notes };
}

function buildSodiumNote(sodiumMg: number, level: SodiumSubScore['level']): string {
  const equiv = (sodiumMg * 2.5).toFixed(0); // Sodium → Salt: × 2.5
  switch (level) {
    case 'very_low':
      return `Very low sodium (${sodiumMg} mg/100g ≈ ${equiv} mg salt). Excellent for heart health.`;
    case 'low':
      return `Low sodium (${sodiumMg} mg/100g ≈ ${equiv} mg salt). Within WHO daily guidelines.`;
    case 'moderate':
      return `Moderate sodium (${sodiumMg} mg/100g ≈ ${equiv} mg salt). Monitor if consuming large portions.`;
    case 'high':
      return `High sodium (${sodiumMg} mg/100g ≈ ${equiv} mg salt/100g). FSSAI threshold exceeded. Limit intake if managing blood pressure.`;
    case 'very_high':
      return `Very high sodium (${sodiumMg} mg/100g ≈ ${equiv} mg salt/100g). Significantly above WHO recommendation of <2000 mg/day total. Consider alternatives.`;
  }
}

// Sugar sub-score — pure function, no side effects.
// Uses added sugar when available (direct label), total sugars as fallback (ADR-0007).
// Source: WHO Free Sugars Guideline 2015; FSSAI Labelling 2022.
// Returns 0–100: 100 = very low sugar (best), 0 = very high sugar (worst).

import { SUGAR_THRESHOLDS_G } from '../thresholds.js';
import type { NegativeNutrientThresholds } from '../standards/types.js';

export interface SugarSubScore {
  score: number;
  sugarG: number;
  isEstimated: boolean;
  level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  notes: string;
}

export function scoreSugar(
  sugarsAddedG: number | null | undefined,
  sugarsG: number | null | undefined,
  sugarsAddedEstimated: boolean,
  thresholds: NegativeNutrientThresholds = SUGAR_THRESHOLDS_G,
): SugarSubScore {
  // Prefer added sugar if available; fall back to total sugars
  const value = sugarsAddedG ?? sugarsG;
  const isEstimated = sugarsAddedEstimated || (sugarsAddedG == null && sugarsG != null);

  if (value === null || value === undefined) {
    return {
      score: 50,
      sugarG: 0,
      isEstimated: false,
      level: 'moderate',
      notes: 'Sugar content unknown; neutral score applied',
    };
  }

  const t = thresholds;

  let score: number;
  let level: SugarSubScore['level'];

  if (value <= t.veryLow) {
    score = 100;
    level = 'very_low';
  } else if (value <= t.low) {
    score = 85 - ((value - t.veryLow) / (t.low - t.veryLow)) * 15;
    level = 'low';
  } else if (value <= t.moderate) {
    score = 70 - ((value - t.low) / (t.moderate - t.low)) * 25;
    level = 'moderate';
  } else if (value <= t.high) {
    score = 45 - ((value - t.moderate) / (t.high - t.moderate)) * 25;
    level = 'high';
  } else if (value <= t.veryHigh) {
    score = 20 - ((value - t.high) / (t.veryHigh - t.high)) * 20;
    level = 'very_high';
  } else {
    score = 0;
    level = 'very_high';
  }

  const estimationNote = isEstimated
    ? ' (value is total sugars as upper bound — added sugar not declared on label; ADR-0007)'
    : '';

  return {
    score: Math.round(score * 10) / 10,
    sugarG: value,
    isEstimated,
    level,
    notes: `${_levelNote(level, value)}${estimationNote}`,
  };
}

function _levelNote(level: SugarSubScore['level'], sugarG: number): string {
  switch (level) {
    case 'very_low': return `Very low sugar (${sugarG.toFixed(1)}g/100g). Excellent choice.`;
    case 'low':      return `Low sugar (${sugarG.toFixed(1)}g/100g).`;
    case 'moderate': return `Moderate sugar (${sugarG.toFixed(1)}g/100g). Suitable in moderation.`;
    case 'high':     return `High sugar (${sugarG.toFixed(1)}g/100g). Exceeds FSSAI "high sugar" threshold (15g/100g). Limit intake.`;
    case 'very_high':return `Very high sugar (${sugarG.toFixed(1)}g/100g). WHO daily free sugar limit (50g) may be exceeded in a single serving. Avoid or limit significantly.`;
  }
}

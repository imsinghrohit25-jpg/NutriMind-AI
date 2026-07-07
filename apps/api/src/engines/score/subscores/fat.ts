// Fat sub-scores — pure functions, no side effects.
// Covers saturated fat and trans fat separately (both are independent FSSAI concerns).
// Source: WHO Global Targets 2025 (trans fat elimination), FSSAI 2022.

import { SAT_FAT_THRESHOLDS_G, TRANS_FAT_THRESHOLDS_G } from '../thresholds.js';

export interface SatFatSubScore {
  score: number;
  satFatG: number;
  level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  notes: string;
}

export interface TransFatSubScore {
  score: number;
  transFatG: number;
  level: 'none' | 'trace' | 'present' | 'high';
  notes: string;
}

export function scoreSatFat(satFatG: number | null | undefined): SatFatSubScore {
  if (satFatG === null || satFatG === undefined) {
    return { score: 50, satFatG: 0, level: 'moderate', notes: 'Saturated fat unknown; neutral score applied' };
  }

  const t = SAT_FAT_THRESHOLDS_G;
  let score: number;
  let level: SatFatSubScore['level'];

  if (satFatG <= t.veryLow) {
    score = 100;  level = 'very_low';
  } else if (satFatG <= t.low) {
    score = 85 - ((satFatG - t.veryLow) / (t.low - t.veryLow)) * 20;
    level = 'low';
  } else if (satFatG <= t.moderate) {
    score = 65 - ((satFatG - t.low) / (t.moderate - t.low)) * 25;
    level = 'moderate';
  } else if (satFatG <= t.high) {
    score = 40 - ((satFatG - t.moderate) / (t.high - t.moderate)) * 25;
    level = 'high';
  } else if (satFatG <= t.veryHigh) {
    score = 15 - ((satFatG - t.high) / (t.veryHigh - t.high)) * 15;
    level = 'very_high';
  } else {
    score = 0; level = 'very_high';
  }

  return {
    score: Math.round(score * 10) / 10,
    satFatG,
    level,
    notes: _satFatNote(level, satFatG),
  };
}

export function scoreTransFat(transFatG: number | null | undefined): TransFatSubScore {
  if (transFatG === null || transFatG === undefined) {
    return {
      score: 70,  // slight penalty for unknown (safer assumption)
      transFatG: 0,
      level: 'trace',
      notes: 'Trans fat not declared; score conservatively penalised',
    };
  }

  const t = TRANS_FAT_THRESHOLDS_G;
  let score: number;
  let level: TransFatSubScore['level'];

  if (transFatG <= t.none) {
    score = 100; level = 'none';
  } else if (transFatG <= t.trace) {
    score = 80; level = 'trace';
  } else if (transFatG <= t.low) {
    score = 50; level = 'present';
  } else {
    score = Math.max(0, 50 - ((transFatG - t.low) / t.high) * 50);
    level = 'high';
  }

  return {
    score: Math.round(score * 10) / 10,
    transFatG,
    level,
    notes: _transFatNote(level, transFatG),
  };
}

function _satFatNote(level: SatFatSubScore['level'], g: number): string {
  switch (level) {
    case 'very_low': return `Very low saturated fat (${g.toFixed(1)}g/100g). Cardiovascular friendly.`;
    case 'low':      return `Low saturated fat (${g.toFixed(1)}g/100g).`;
    case 'moderate': return `Moderate saturated fat (${g.toFixed(1)}g/100g). Within limits for most adults.`;
    case 'high':     return `High saturated fat (${g.toFixed(1)}g/100g). Exceeds FSSAI "high" threshold (5g/100g). Limit intake, especially if managing cholesterol.`;
    case 'very_high':return `Very high saturated fat (${g.toFixed(1)}g/100g). ICMR-NIN recommends saturated fat < 10% of total energy. Significantly exceeds this in most servings.`;
  }
}

function _transFatNote(level: TransFatSubScore['level'], g: number): string {
  switch (level) {
    case 'none':    return 'No trans fat. Excellent.';
    case 'trace':   return `Trace trans fat (${g.toFixed(2)}g/100g). Within safe limits.`;
    case 'present': return `Trans fat present (${g.toFixed(2)}g/100g). WHO recommends eliminating trans fats from food supply. Limit intake.`;
    case 'high':    return `High trans fat (${g.toFixed(2)}g/100g). Significantly above FSSAI limit (<2% of total fat). Avoid this product or choose alternatives.`;
  }
}

// Dietary fibre sub-score — pure function, no side effects.
// Source: FSSAI Labelling Regulations 2022; ICMR-NIN 2020 (25–38g/day target).
// Returns 0–100: 100 = high fibre (best), 0 = no fibre.

import { FIBRE_THRESHOLDS_G } from '../thresholds.js';
import type { PositiveNutrientThresholds } from '../standards/types.js';

export interface FibreSubScore {
  score: number;
  fibreG: number;
  level: 'none' | 'low' | 'moderate' | 'high' | 'very_high';
  notes: string;
}

export function scoreFibre(
  fibreG: number | null | undefined,
  thresholds: PositiveNutrientThresholds = FIBRE_THRESHOLDS_G,
): FibreSubScore {
  if (fibreG === null || fibreG === undefined) {
    return { score: 30, fibreG: 0, level: 'none', notes: 'Fibre not declared; minimal score applied' };
  }

  const t = thresholds;
  let score: number;
  let level: FibreSubScore['level'];

  if (fibreG <= t.veryLow) {
    score = 0; level = 'none';
  } else if (fibreG <= t.low) {
    score = (fibreG / t.low) * 20;
    level = 'low';
  } else if (fibreG <= t.moderate) {
    score = 20 + ((fibreG - t.low) / (t.moderate - t.low)) * 30;
    level = 'moderate';
  } else if (fibreG <= t.high) {
    score = 50 + ((fibreG - t.moderate) / (t.high - t.moderate)) * 25;
    level = 'high';
  } else if (fibreG <= t.veryHigh) {
    score = 75 + ((fibreG - t.high) / (t.veryHigh - t.high)) * 25;
    level = 'very_high';
  } else {
    score = 100; level = 'very_high';
  }

  return {
    score: Math.round(score * 10) / 10,
    fibreG,
    level,
    notes: _fibreNote(level, fibreG),
  };
}

function _fibreNote(level: FibreSubScore['level'], g: number): string {
  switch (level) {
    case 'none':     return 'No dietary fibre. Choose whole-grain alternatives where possible.';
    case 'low':      return `Low fibre (${g.toFixed(1)}g/100g). Consider pairing with high-fibre foods.`;
    case 'moderate': return `Moderate fibre (${g.toFixed(1)}g/100g). Contributes to daily ICMR-NIN target of 25–38g.`;
    case 'high':     return `High fibre (${g.toFixed(1)}g/100g). Meets FSSAI "source of fibre" claim (≥3g/100g). Good for digestive health.`;
    case 'very_high':return `Very high fibre (${g.toFixed(1)}g/100g). FSSAI "high fibre" (≥6g/100g). Excellent for satiety and gut health.`;
  }
}

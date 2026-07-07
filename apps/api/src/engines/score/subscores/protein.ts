// Protein sub-score — pure function, no side effects.
// Source: ICMR-NIN RDA 2020 (0.83g/kg body weight/day).
// Returns 0–100: 100 = high protein (best), 0 = negligible protein.

import { PROTEIN_THRESHOLDS_G } from '../thresholds.js';

export interface ProteinSubScore {
  score: number;
  proteinG: number;
  level: 'none' | 'low' | 'moderate' | 'high' | 'very_high';
  notes: string;
}

export function scoreProtein(proteinG: number | null | undefined): ProteinSubScore {
  if (proteinG === null || proteinG === undefined) {
    return { score: 30, proteinG: 0, level: 'none', notes: 'Protein not declared; minimal score applied' };
  }

  const t = PROTEIN_THRESHOLDS_G;
  let score: number;
  let level: ProteinSubScore['level'];

  if (proteinG <= t.none) {
    score = 0; level = 'none';
  } else if (proteinG <= t.low) {
    score = ((proteinG - t.none) / (t.low - t.none)) * 25;
    level = 'low';
  } else if (proteinG <= t.moderate) {
    score = 25 + ((proteinG - t.low) / (t.moderate - t.low)) * 25;
    level = 'moderate';
  } else if (proteinG <= t.high) {
    score = 50 + ((proteinG - t.moderate) / (t.high - t.moderate)) * 30;
    level = 'high';
  } else if (proteinG <= t.veryHigh) {
    score = 80 + ((proteinG - t.high) / (t.veryHigh - t.high)) * 20;
    level = 'very_high';
  } else {
    score = 100; level = 'very_high';
  }

  return {
    score: Math.round(score * 10) / 10,
    proteinG,
    level,
    notes: _proteinNote(level, proteinG),
  };
}

function _proteinNote(level: ProteinSubScore['level'], g: number): string {
  switch (level) {
    case 'none':     return 'Negligible protein. Not a significant protein source.';
    case 'low':      return `Low protein (${g.toFixed(1)}g/100g).`;
    case 'moderate': return `Moderate protein (${g.toFixed(1)}g/100g). Contributes to ICMR-NIN daily protein target.`;
    case 'high':     return `High protein (${g.toFixed(1)}g/100g). Good protein source. FSSAI "high protein" claim: ≥12g/100g.`;
    case 'very_high':return `Very high protein (${g.toFixed(1)}g/100g). Excellent protein source for muscle health and satiety.`;
  }
}

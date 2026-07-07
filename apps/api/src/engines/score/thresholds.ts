// Nutrient thresholds per 100g of food.
// Source: ICMR-NIN Recommended Dietary Allowances 2020 (India-adapted),
//         WHO Salt Reduction Guidelines 2023,
//         FSSAI Food Safety and Standards (Labelling and Display) Regulations 2022.
// All thresholds are per 100g; scoring functions normalise against these.

// ── Negative nutrients (higher = worse) ──────────────────────────────────────

export const SODIUM_THRESHOLDS_MG = {
  veryLow:  90,    // < 90 mg/100g → full negative-nutrient score credit
  low:      120,
  moderate: 360,
  high:     600,   // FSSAI "high" threshold
  veryHigh: 900,   // no additional credit below this; worst-case
};

// Free sugars (total sugars used as proxy when added sugar not available — ADR-0007)
export const SUGAR_THRESHOLDS_G = {
  veryLow:  4.5,
  low:      9,
  moderate: 15,    // FSSAI "high" threshold
  high:     22.5,
  veryHigh: 40,
};

export const SAT_FAT_THRESHOLDS_G = {
  veryLow:  1.0,
  low:      2.5,
  moderate: 5.0,   // FSSAI "high in saturated fat"
  high:     7.5,
  veryHigh: 10.0,
};

export const TRANS_FAT_THRESHOLDS_G = {
  none:   0.0,
  trace:  0.5,
  low:    1.0,
  high:   2.0,     // WHO/FSSAI maximum for labelling
};

// ── Positive nutrients (higher = better) ─────────────────────────────────────

export const FIBRE_THRESHOLDS_G = {
  none:   0.0,
  low:    0.9,
  moderate: 3.0,
  high:   6.0,     // FSSAI "source of fibre"
  veryHigh: 9.0,   // FSSAI "high fibre"
};

export const PROTEIN_THRESHOLDS_G = {
  none:   1.6,
  low:    3.2,
  moderate: 6.0,
  high:   12.0,
  veryHigh: 20.0,
};

// ── NOVA group scores (0–100 each) ───────────────────────────────────────────
// NOVA classification: Monteiro et al. 2019.
// Adapted for Indian context where fermented and traditionally processed foods (NOVA 3)
// should not be penalised as heavily as industrially ultra-processed (NOVA 4).

export const NOVA_SCORES: Record<1 | 2 | 3 | 4, number> = {
  1: 100,  // Unprocessed or minimally processed: rice, dal, vegetables, milk
  2: 70,   // Processed culinary ingredients: ghee, oil, sugar, salt, flour
  3: 45,   // Processed: canned fish, salted nuts, traditional pickles
  4: 10,   // Ultra-processed: instant noodles, packaged biscuits, soft drinks, chips
};

export const NOVA_DEFAULT_SCORE = 50;  // when NOVA group is unknown

// ── Score band thresholds ─────────────────────────────────────────────────────
export const SCORE_BANDS = {
  excellent: 80,   // 80–100: green badge
  good:      60,   // 60–79: light green
  fair:      40,   // 40–59: amber
  poor:      20,   // 20–39: orange-red
  // < 20: red (bad)
} as const;

export type ScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export function scoreBand(score: number): ScoreBand {
  if (score >= SCORE_BANDS.excellent) return 'excellent';
  if (score >= SCORE_BANDS.good) return 'good';
  if (score >= SCORE_BANDS.fair) return 'fair';
  if (score >= SCORE_BANDS.poor) return 'poor';
  return 'bad';
}

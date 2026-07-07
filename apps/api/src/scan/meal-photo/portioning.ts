// Portion estimation — converts dish candidates + optional LLM portion hints
// into gram weights for nutrition calculation.
// Strategy: lookup IFCT/USDA standard serving → scale by portion hint.
// No LLM call here; LLM output (portionSizeHint) is parsed by deterministic rules.
// Confidence is low when no standard serving size is available.

export interface PortionEstimate {
  dishName: string;
  portionGrams: number;
  confidence: 'high' | 'medium' | 'low';
  method: 'standard_serving' | 'hint_parsed' | 'default_guess';
  notes: string | null;
}

// Standard serving sizes (g) for common Indian dishes — from IFCT 2017 / ICMR guidelines.
// Source: ICMR "Recommended Dietary Allowances" reference serving size tables.
// This map is intentionally conservative; unknown dishes get the default_guess path.
const STANDARD_SERVINGS_G: Record<string, number> = {
  // Cereals/grains
  'rice (cooked)': 150,
  'rice': 150,
  'steamed rice': 150,
  'roti': 40,
  'chapati': 40,
  'paratha': 60,
  'naan': 80,
  'idli': 40,
  'dosa': 80,
  'uttapam': 100,
  'puri': 35,
  'bhature': 70,
  // Dal/legumes
  'dal': 180,
  'dal tadka': 180,
  'dal makhani': 180,
  'rajma': 180,
  'chana masala': 180,
  'chole': 180,
  'sambar': 150,
  // Vegetables
  'sabzi': 150,
  'aloo sabzi': 150,
  'palak paneer': 150,
  'paneer butter masala': 150,
  'matar paneer': 150,
  'bhindi masala': 120,
  'baingan bhartha': 120,
  'methi malai matar': 150,
  // Snacks
  'samosa': 60,
  'kachori': 55,
  'pakora': 50,
  'bhajia': 50,
  'vada': 45,
  'medu vada': 45,
  // Non-veg
  'chicken curry': 150,
  'mutton curry': 150,
  'fish curry': 150,
  'egg curry': 100,
  'tandoori chicken': 120,
  // Sweets/desserts
  'kheer': 100,
  'gulab jamun': 50,
  'rasgulla': 50,
  'halwa': 80,
  'barfi': 30,
  'jalebi': 40,
  // Beverages
  'chai': 150,
  'lassi': 200,
  'milk': 200,
};

// Modifier words that scale the standard serving.
// e.g. "large bowl" → 1.5×, "small katori" → 0.7×
const PORTION_MODIFIERS: Array<{ pattern: RegExp; scale: number }> = [
  { pattern: /\bxl\b|extra\s+large|very\s+large/i, scale: 2.0 },
  { pattern: /\blarge\b/i,   scale: 1.5 },
  { pattern: /\bmedium\b/i,  scale: 1.0 },
  { pattern: /\bsmall\b/i,   scale: 0.7 },
  { pattern: /\bhalf\b/i,    scale: 0.5 },
  { pattern: /\bdouble\b/i,  scale: 2.0 },
  { pattern: /\b2\s*pieces?\b|\btwo\b/i,  scale: 2.0 },
  { pattern: /\b3\s*pieces?\b|\bthree\b/i, scale: 3.0 },
];

export function estimatePortion(
  dishName: string,
  portionSizeHint: string | null,
): PortionEstimate {
  const normalised = dishName.toLowerCase().trim();

  // Look up standard serving
  let baseGrams: number | null = null;
  for (const [key, grams] of Object.entries(STANDARD_SERVINGS_G)) {
    if (normalised.includes(key) || key.includes(normalised)) {
      baseGrams = grams;
      break;
    }
  }

  if (baseGrams === null) {
    // Unknown dish — use 150g as default guess (typical Indian side dish serving)
    return {
      dishName,
      portionGrams: 150,
      confidence: 'low',
      method: 'default_guess',
      notes: `Unknown dish "${dishName}" — using 150g default. Please confirm.`,
    };
  }

  // Apply portion hint modifier
  let scale = 1.0;
  let method: 'standard_serving' | 'hint_parsed' = 'standard_serving';

  if (portionSizeHint) {
    for (const mod of PORTION_MODIFIERS) {
      if (mod.pattern.test(portionSizeHint)) {
        scale = mod.scale;
        method = 'hint_parsed';
        break;
      }
    }

    // Explicit gram/ml amount in the hint
    const explicitGrams = portionSizeHint.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?|ml)/i);
    if (explicitGrams?.[1]) {
      return {
        dishName,
        portionGrams: parseFloat(explicitGrams[1]),
        confidence: 'high',
        method: 'hint_parsed',
        notes: `Explicit portion size from hint: ${portionSizeHint}`,
      };
    }
  }

  return {
    dishName,
    portionGrams: Math.round(baseGrams * scale),
    confidence: method === 'hint_parsed' ? 'medium' : 'high',
    method,
    notes: scale !== 1.0 ? `Scaled by ${scale}× from hint "${portionSizeHint}"` : null,
  };
}

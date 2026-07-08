// Shared per-gram nutrient density estimator — pure function, no LLM, no side effects.
// Extracted from restaurant/recipe-generator.ts (Phase 5) so both recipe ingredients and
// restaurant menu items (`estimated_nutrition_label`, ADR-0018) use the same deterministic
// estimation logic. Consistent with the project's LLM policy: the LLM may only identify what
// an ingredient/dish *is* (name, category) — this module is what turns that identification
// into numbers, and it never calls an LLM itself.
//
// These are approximate per-gram densities for common Indian ingredients (the vocabulary
// recipe-generator.ts and menu-scanner.ts currently produce — see ADR-0018 for the scope
// note on cuisine coverage). Full accuracy requires an actual product/IFCT database lookup;
// this table is the deterministic fallback when no product match exists.

export interface EstimatedNutrients {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
  fibre:    number;
  sodium:   number;
}

const NUTRIENT_DENSITY: Record<string, { cal: number; protein: number; carbs: number; fat: number; fibre: number; sodium: number }> = {
  // Grains
  'rice':            { cal: 3.6, protein: 0.07, carbs: 0.79, fat: 0.003, fibre: 0.003, sodium: 0.001 },
  'atta':            { cal: 3.4, protein: 0.11, carbs: 0.72, fat: 0.015, fibre: 0.024, sodium: 0.002 },
  'maida':           { cal: 3.5, protein: 0.10, carbs: 0.73, fat: 0.010, fibre: 0.003, sodium: 0.002 },
  // Lentils / legumes
  'dal':             { cal: 3.5, protein: 0.23, carbs: 0.58, fat: 0.008, fibre: 0.12,  sodium: 0.003 },
  'chana':           { cal: 3.6, protein: 0.17, carbs: 0.61, fat: 0.05,  fibre: 0.17,  sodium: 0.003 },
  'rajma':           { cal: 3.4, protein: 0.22, carbs: 0.60, fat: 0.012, fibre: 0.15,  sodium: 0.002 },
  // Dairy
  'paneer':          { cal: 2.65, protein: 0.18, carbs: 0.02, fat: 0.20,  fibre: 0,     sodium: 0.012 },
  'milk':            { cal: 0.62, protein: 0.033, carbs: 0.048, fat: 0.036, fibre: 0,   sodium: 0.004 },
  'curd':            { cal: 0.60, protein: 0.035, carbs: 0.049, fat: 0.031, fibre: 0,   sodium: 0.004 },
  'ghee':            { cal: 9.0, protein: 0,     carbs: 0,     fat: 0.995, fibre: 0,    sodium: 0.001 },
  'oil':             { cal: 8.8, protein: 0,     carbs: 0,     fat: 1.0,   fibre: 0,    sodium: 0 },
  // Vegetables
  'spinach':         { cal: 0.23, protein: 0.030, carbs: 0.036, fat: 0.004, fibre: 0.022, sodium: 0.008 },
  'tomato':          { cal: 0.18, protein: 0.009, carbs: 0.039, fat: 0.002, fibre: 0.012, sodium: 0.005 },
  'onion':           { cal: 0.40, protein: 0.011, carbs: 0.093, fat: 0.001, fibre: 0.017, sodium: 0.004 },
  'potato':          { cal: 0.77, protein: 0.020, carbs: 0.175, fat: 0.001, fibre: 0.022, sodium: 0.006 },
  // Chicken
  'chicken':         { cal: 2.39, protein: 0.27,  carbs: 0,     fat: 0.14,  fibre: 0,    sodium: 0.07 },
  // Spices (assume negligible nutrition at typical quantities)
  'garam masala':    { cal: 3.0, protein: 0.10, carbs: 0.50, fat: 0.08, fibre: 0.20, sodium: 0.05 },
};

const GENERIC_FALLBACK_CAL_PER_GRAM = 2;

/**
 * Estimate nutrients for `grams` of an ingredient/dish identified by `name`, using a
 * substring match against the density table. Falls back to a generic ~2 kcal/g estimate
 * (macros unknown, all zero) when no match is found — never throws, never guesses a specific
 * macro breakdown it has no basis for.
 */
export function estimateNutrientsByDensity(name: string, grams: number): EstimatedNutrients {
  const key = Object.keys(NUTRIENT_DENSITY).find((k) => name.toLowerCase().includes(k));
  if (!key) {
    return { calories: Math.round(grams * GENERIC_FALLBACK_CAL_PER_GRAM), protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 0 };
  }
  const d = NUTRIENT_DENSITY[key]!;
  return {
    calories: Math.round(grams * d.cal),
    protein:  Math.round(grams * d.protein * 10) / 10,
    carbs:    Math.round(grams * d.carbs * 10) / 10,
    fat:      Math.round(grams * d.fat * 10) / 10,
    fibre:    Math.round(grams * d.fibre * 10) / 10,
    sodium:   Math.round(grams * d.sodium * 10) / 10,
  };
}

export function sumNutrients(nutrients: EstimatedNutrients[]): EstimatedNutrients {
  return nutrients.reduce(
    (acc, n) => ({
      calories: acc.calories + n.calories,
      protein:  acc.protein  + n.protein,
      carbs:    acc.carbs    + n.carbs,
      fat:      acc.fat      + n.fat,
      fibre:    acc.fibre    + n.fibre,
      sodium:   acc.sodium   + n.sodium,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 0 },
  );
}

export function divideNutrients(total: EstimatedNutrients, by: number): EstimatedNutrients {
  const d = Math.max(by, 1);
  return {
    calories: Math.round(total.calories / d),
    protein:  Math.round(total.protein  / d * 10) / 10,
    carbs:    Math.round(total.carbs    / d * 10) / 10,
    fat:      Math.round(total.fat      / d * 10) / 10,
    fibre:    Math.round(total.fibre    / d * 10) / 10,
    sodium:   Math.round(total.sodium   / d * 10) / 10,
  };
}

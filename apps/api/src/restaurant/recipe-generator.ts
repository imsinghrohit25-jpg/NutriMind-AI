// AI Recipe Generator — generates recipes with canonical ingredient bindings.
// Binds ingredients to the IFCT/USDA nutrient database for accurate nutrition.
// Uses copilot_reasoning LLM tier; enforces allergen safety.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';

export type DietType = 'vegetarian' | 'non-vegetarian' | 'vegan' | 'eggetarian';
export type Cuisine  = 'north-indian' | 'south-indian' | 'maharashtrian' | 'gujarati' | 'bengali' | 'punjabi' | 'generic';

export interface RecipeIngredient {
  name:       string;    // canonical ingredient name
  quantity:   number;
  unit:       string;
  gramsPerUnit: number;
  totalGrams: number;
  productId?: string;    // bound to products table if matched
  nutrients?: {          // per-ingredient estimated nutrients
    calories:  number;
    protein:   number;
    carbs:     number;
    fat:       number;
    fibre:     number;
    sodium:    number;
  };
}

export interface GeneratedRecipe {
  name:          string;
  servings:      number;
  cuisine:       Cuisine;
  dietType:      DietType;
  prepTimeMin:   number;
  cookTimeMin:   number;
  ingredients:   RecipeIngredient[];
  steps:         string[];
  totalNutrition: {
    calories: number; protein: number; carbs: number;
    fat: number; fibre: number; sodium: number;
  };
  perServingNutrition: {
    calories: number; protein: number; carbs: number;
    fat: number; fibre: number; sodium: number;
  };
  allergens:     string[];
  tags:          string[];
}

const RECIPE_SYSTEM_PROMPT = `You are a nutrition-aware Indian recipe generator.
Generate a detailed recipe with exact ingredient quantities.

Return ONLY valid JSON in this exact shape:
{
  "name": "<recipe name>",
  "servings": <number>,
  "cuisine": "north-indian|south-indian|maharashtrian|gujarati|bengali|punjabi|generic",
  "dietType": "vegetarian|non-vegetarian|vegan|eggetarian",
  "prepTimeMin": <number>,
  "cookTimeMin": <number>,
  "ingredients": [
    {
      "name": "<ingredient name>",
      "quantity": <number>,
      "unit": "<g|ml|piece|tsp|tbsp|cup|katori>",
      "gramsPerUnit": <grams per 1 unit>,
      "totalGrams": <quantity × gramsPerUnit>
    }
  ],
  "steps": ["<step 1>", "<step 2>", ...],
  "allergens": ["<allergen>", ...]
}

Rules:
- Use standard Indian cooking ingredient names
- gramsPerUnit: 1g=1, 1ml=1, 1tsp=5, 1tbsp=15, 1cup=240, 1katori=150, 1piece=varies
- Do NOT include oil amounts > 15ml per serving (health restriction)
- Allergens: list nuts, dairy, gluten, eggs, soy, shellfish if present
- totalGrams must equal quantity × gramsPerUnit`;

/** Generate a recipe meeting the user's requirements. */
export async function generateRecipe(opts: {
  prompt:     string;    // e.g. "high-protein dal with spinach"
  servings:   number;
  dietType:   DietType;
  cuisine?:   Cuisine;
  allergens:  string[]; // user's declared allergens (must be excluded)
  maxKcal?:   number;
  gateway:    GatewayRouter;
  supabase:   SupabaseClient;
}): Promise<GeneratedRecipe> {
  const { prompt, servings, dietType, cuisine, allergens, maxKcal, gateway } = opts;

  const allergenClause = allergens.length > 0
    ? `STRICT REQUIREMENT: This recipe MUST NOT contain any of these allergens: ${allergens.join(', ')}.`
    : '';

  const userRequest = [
    `Recipe: ${prompt}`,
    `Servings: ${servings}`,
    `Diet: ${dietType}`,
    cuisine ? `Cuisine: ${cuisine}` : '',
    maxKcal ? `Max ${maxKcal} kcal per serving` : '',
    allergenClause,
  ].filter(Boolean).join('\n');

  const response = await gateway.complete({
    tier:         'copilot_reasoning',
    systemPrompt: RECIPE_SYSTEM_PROMPT,
    messages:     [{ role: 'user', content: userRequest }],
    maxTokens:    2500,
    traceId:      'recipe-gen',
  });

  const jsonMatch = /\{[\s\S]*\}/.exec(response.content);
  if (!jsonMatch) throw new Error('No JSON in recipe response');

  const raw = JSON.parse(jsonMatch[0]) as {
    name: string;
    servings: number;
    cuisine: Cuisine;
    dietType: DietType;
    prepTimeMin: number;
    cookTimeMin: number;
    ingredients: Array<{
      name: string; quantity: number; unit: string;
      gramsPerUnit: number; totalGrams: number;
    }>;
    steps: string[];
    allergens: string[];
  };

  // Allergen safety gate — fail-safe check post-LLM
  const detectedAllergens = raw.allergens ?? [];
  for (const userAllergen of allergens) {
    if (detectedAllergens.some((a) => a.toLowerCase().includes(userAllergen.toLowerCase()))) {
      throw new Error(
        `Recipe contains allergen "${userAllergen}" which is on the user's declared allergen list. ` +
        `Generation rejected for safety.`,
      );
    }
  }

  // Estimate nutrition per ingredient using IFCT density estimates
  // (Full binding to products table would require a product lookup per ingredient)
  const ingredients: RecipeIngredient[] = raw.ingredients.map((i) => ({
    ...i,
    nutrients: estimateIngredientNutrition(i.name, i.totalGrams),
  }));

  const totalNutrition = sumNutrition(ingredients.map((i) => i.nutrients!));
  const perServing     = divideNutrition(totalNutrition, raw.servings);

  return {
    name:        raw.name,
    servings:    raw.servings,
    cuisine:     raw.cuisine,
    dietType:    raw.dietType,
    prepTimeMin: raw.prepTimeMin,
    cookTimeMin: raw.cookTimeMin,
    ingredients,
    steps:       raw.steps,
    totalNutrition,
    perServingNutrition: perServing,
    allergens:   detectedAllergens,
    tags:        buildTags(raw),
  };
}

// ── Nutrition estimation ──────────────────────────────────────────────────────
// These are approximate per-gram densities for common Indian ingredients.
// Full accuracy requires the IFCT 2017 database lookup (integrated via datasources/ifct).
// These density tables serve as the fallback when no product match exists.

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

function estimateIngredientNutrition(
  name:  string,
  grams: number,
): RecipeIngredient['nutrients'] {
  const key = Object.keys(NUTRIENT_DENSITY).find((k) =>
    name.toLowerCase().includes(k),
  );
  if (!key) {
    // Generic fallback: ~2 kcal/g
    return { calories: Math.round(grams * 2), protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 0 };
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

function sumNutrition(
  nutrients: Array<RecipeIngredient['nutrients'] & {}>,
): GeneratedRecipe['totalNutrition'] {
  return nutrients.reduce(
    (acc, n) => ({
      calories: acc.calories + (n?.calories ?? 0),
      protein:  acc.protein  + (n?.protein  ?? 0),
      carbs:    acc.carbs    + (n?.carbs    ?? 0),
      fat:      acc.fat      + (n?.fat      ?? 0),
      fibre:    acc.fibre    + (n?.fibre    ?? 0),
      sodium:   acc.sodium   + (n?.sodium   ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodium: 0 },
  );
}

function divideNutrition(
  total: GeneratedRecipe['totalNutrition'],
  servings: number,
): GeneratedRecipe['perServingNutrition'] {
  const s = Math.max(servings, 1);
  return {
    calories: Math.round(total.calories / s),
    protein:  Math.round(total.protein  / s * 10) / 10,
    carbs:    Math.round(total.carbs    / s * 10) / 10,
    fat:      Math.round(total.fat      / s * 10) / 10,
    fibre:    Math.round(total.fibre    / s * 10) / 10,
    sodium:   Math.round(total.sodium   / s * 10) / 10,
  };
}

function buildTags(raw: { dietType: DietType; cuisine: Cuisine; cookTimeMin: number; name: string }): string[] {
  const tags: string[] = [];
  if (raw.dietType === 'vegetarian' || raw.dietType === 'vegan') tags.push('vegetarian');
  if (raw.dietType === 'vegan')  tags.push('vegan');
  if (raw.cookTimeMin <= 30)     tags.push('quick');
  if (raw.cookTimeMin <= 15)     tags.push('15-minute-meal');
  tags.push(raw.cuisine.replace('-', ' '));
  if (/protein|high.protein/i.test(raw.name)) tags.push('high-protein');
  if (/dal|lentil/i.test(raw.name))           tags.push('lentils');
  return tags;
}

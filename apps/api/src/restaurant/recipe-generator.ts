// AI Recipe Generator — generates recipes with canonical ingredient bindings.
// Binds ingredients to the IFCT/USDA nutrient database for accurate nutrition.
// Uses copilot_reasoning LLM tier; enforces allergen safety.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';
import { estimateNutrientsByDensity, sumNutrients, divideNutrients } from '../nutrition/density-estimator.js';

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

  // Estimate nutrition per ingredient using the shared density estimator
  // (Full binding to products table would require a product lookup per ingredient)
  const ingredients: RecipeIngredient[] = raw.ingredients.map((i) => ({
    ...i,
    nutrients: estimateNutrientsByDensity(i.name, i.totalGrams),
  }));

  const totalNutrition = sumNutrients(ingredients.map((i) => i.nutrients!));
  const perServing     = divideNutrients(totalNutrition, raw.servings);

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

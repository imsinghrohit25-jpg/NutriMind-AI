// Restaurant menu scanner — extracts menu items from OCR text or images.
// Uses vision_analysis LLM tier for image-based menus.
// Returns structured menu items with canonical ingredient bindings.

import type { GatewayRouter } from '../gateway/router.js';
import { estimateNutrientsByDensity, sumNutrients, type EstimatedNutrients } from '../nutrition/density-estimator.js';

export interface MenuItem {
  name:         string;
  description?: string;
  priceRs?:     number;
  category?:    string;   // 'starter' | 'main' | 'dessert' | 'drink' | 'bread' | 'rice' | 'biryani' | ...
  isVeg:        boolean;  // true for ◉ green dot marked items
  ingredients?: string[]; // extracted from description
}

export interface MenuItemNutritionEstimate {
  nutrients:   EstimatedNutrients;
  isEstimated: true;
  confidence:  number;  // 0.0–1.0 — always low; this is a rough per-portion estimate, not a lab value
  basis:       'ingredient_density' | 'no_ingredients_unknown';
}

export interface MenuScanResult {
  items:       MenuItem[];
  restaurantName?: string;
  cuisine?:    string;
  confidence:  number;
}

const MENU_EXTRACTION_PROMPT = `You are a restaurant menu parser for Indian restaurants.
Extract all menu items from the text.

Return ONLY valid JSON in this shape:
{
  "restaurantName": "<string|null>",
  "cuisine": "<Indian/Chinese/Italian/Continental/null>",
  "items": [
    {
      "name": "<item name>",
      "description": "<description or null>",
      "priceRs": <number|null>,
      "category": "<starter|main|dessert|drink|bread|rice|biryani|snack|null>",
      "isVeg": <true|false>,
      "ingredients": ["<ingredient1>", ...]
    }
  ],
  "confidence": <0.0-1.0>
}

Rules:
- isVeg: true if item has ◉ green dot, is labeled "veg", or is clearly vegetarian
- isVeg: false if it has ☞ brown/red dot, contains meat/chicken/fish/egg
- Extract ingredients from description where possible
- Prices should be numeric (remove ₹ symbol)
- category must be one of: starter, main, dessert, drink, bread, rice, biryani, snack
- If confidence is below 0.5, still return what you found`;

export async function scanMenuText(opts: {
  text:    string;
  gateway: GatewayRouter;
}): Promise<MenuScanResult> {
  const { text, gateway } = opts;

  try {
    const response = await gateway.complete({
      tier:         'parse_assist',
      systemPrompt: MENU_EXTRACTION_PROMPT,
      messages:     [{ role: 'user', content: `MENU TEXT:\n${text.slice(0, 6000)}` }],
      maxTokens:    2000,
      traceId:      'menu-scan',
    });

    const jsonMatch = /\{[\s\S]*\}/.exec(response.content);
    if (!jsonMatch) throw new Error('No JSON in menu scan response');

    const parsed = JSON.parse(jsonMatch[0]) as {
      restaurantName?: string;
      cuisine?: string;
      items: MenuItem[];
      confidence: number;
    };

    return {
      items:          parsed.items ?? [],
      restaurantName: parsed.restaurantName ?? undefined,
      cuisine:        parsed.cuisine ?? undefined,
      confidence:     parsed.confidence ?? 0.5,
    };
  } catch {
    return { items: [], confidence: 0 };
  }
}

/** Score a menu item against the user's health profile (deterministic). */
export function scoreMenuItemForUser(opts: {
  item:           MenuItem;
  userSodiumGoal: number;  // mg/day
  isVeg:          boolean; // user preference
  allergens:      string[];
}): { suitable: boolean; warnings: string[]; score: 'good' | 'neutral' | 'avoid' } {
  const { item, isVeg, allergens } = opts;
  const warnings: string[] = [];

  // Veg filter
  if (isVeg && !item.isVeg) {
    return { suitable: false, warnings: ['Non-vegetarian item'], score: 'avoid' };
  }

  // Allergen check
  if (item.ingredients && allergens.length > 0) {
    const lower = item.ingredients.map((i) => i.toLowerCase());
    for (const allergen of allergens) {
      if (lower.some((i) => i.includes(allergen.toLowerCase()))) {
        warnings.push(`Contains ${allergen}`);
        return { suitable: false, warnings, score: 'avoid' };
      }
    }
  }

  // Category heuristics
  if (item.category === 'dessert') {
    warnings.push('High sugar — dessert');
    return { suitable: true, warnings, score: 'neutral' };
  }
  if (item.category === 'drink') {
    return { suitable: true, warnings, score: 'neutral' };
  }

  return { suitable: true, warnings, score: 'good' };
}

// Rough total-portion weight (grams) by menu category — used only to spread the density
// estimate across a plausible restaurant serving size. This is a coarse heuristic, not a
// measurement; `confidence` on the returned estimate reflects that.
const PORTION_GRAMS_BY_CATEGORY: Record<string, number> = {
  starter: 150, snack: 150, bread: 80, rice: 300, biryani: 400,
  main: 350, dessert: 120, drink: 250,
};
const DEFAULT_PORTION_GRAMS = 300;

/**
 * Estimate a nutrition label for a restaurant menu item — Phase 5 (`global.p5.estimated_nutrition_label`).
 *
 * Deterministic only: this never asks an LLM for a calorie/macro number (the LLM's role,
 * in `scanMenuText` above, is limited to identifying item name/category/ingredients — this
 * function turns that identification into numbers via `density-estimator.ts`, same policy
 * as recipe-generator.ts). Always returns `isEstimated: true` with a low `confidence` —
 * this is a rough per-portion approximation, never presented as a measured value.
 */
export function estimateMenuItemNutrition(item: MenuItem): MenuItemNutritionEstimate {
  const portionGrams = (item.category ? PORTION_GRAMS_BY_CATEGORY[item.category] : undefined) ?? DEFAULT_PORTION_GRAMS;

  if (!item.ingredients || item.ingredients.length === 0) {
    return {
      nutrients:   estimateNutrientsByDensity(item.name, portionGrams),
      isEstimated: true,
      confidence:  0.15,
      basis:       'no_ingredients_unknown',
    };
  }

  const gramsPerIngredient = portionGrams / item.ingredients.length;
  const perIngredient = item.ingredients.map((ing) =>
    estimateNutrientsByDensity(ing, gramsPerIngredient),
  );

  return {
    nutrients:   sumNutrients(perIngredient),
    isEstimated: true,
    confidence:  0.35,
    basis:       'ingredient_density',
  };
}

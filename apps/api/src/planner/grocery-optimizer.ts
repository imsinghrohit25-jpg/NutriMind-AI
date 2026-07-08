// Smart grocery list optimizer.
// Aggregates ingredients across all meals in a plan, deduplicates, estimates cost.
//
// Phase 5: pricing/category logic is delegated to a GroceryPriceProvider (country-aware,
// see grocery-providers/). Defaulting to INDIA_GROCERY_PROVIDER (an exact port of the
// pre-Phase-5 hardcoded table) keeps buildGroceryList() byte-identical when no provider is
// passed. See ADR-0018 for the recipe-vocabulary caveat: recipes remain India-cuisine-focused
// for now, so non-India providers price the same ingredient names against their own market.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedRecipe, RecipeIngredient } from '../restaurant/recipe-generator.js';
import type { GroceryPriceProvider } from './grocery-providers/types.js';
import { INDIA_GROCERY_PROVIDER } from './grocery-providers/registry.js';

export interface GroceryItem {
  name:             string;
  quantity:         number;
  unit:             string;
  category:         string;
  estimatedPrice?:  number;
  currencyCode?:    string;
}

function categoriseIngredient(name: string, provider: GroceryPriceProvider): string {
  const lower = name.toLowerCase();
  for (const [key, cat] of Object.entries(provider.categoryMap)) {
    if (lower.includes(key)) return cat;
  }
  return 'spices';
}

function roundToPrecision(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function estimatePrice(name: string, quantityKg: number, provider: GroceryPriceProvider): number {
  const lower = name.toLowerCase();
  for (const [key, pricePerKg] of Object.entries(provider.pricePerKg)) {
    if (lower.includes(key)) return roundToPrecision(pricePerKg * quantityKg, provider.roundToDecimals);
  }
  return roundToPrecision(provider.defaultPricePerKg * quantityKg, provider.roundToDecimals);
}

type UnitKey = 'g' | 'ml' | 'kg' | 'l' | 'tsp' | 'tbsp' | 'cup';
const TO_GRAMS: Record<UnitKey, number> = {
  'g': 1, 'ml': 1, 'kg': 1000, 'l': 1000, 'tsp': 5, 'tbsp': 15, 'cup': 240,
};

function toGrams(quantity: number, unit: string): number {
  const factor = TO_GRAMS[unit.toLowerCase() as UnitKey] ?? 100;
  return quantity * factor;
}

/**
 * Aggregate all recipe ingredients into a single shopping list.
 *
 * `provider` is optional and additive (ADR-0018, Phase 5, flag `global.p5.grocery_provider_chain`):
 * when omitted, this function is byte-identical to its pre-Phase-5 behavior (India pricing/
 * categories, whole-rupee rounding). Callers resolve the right provider (e.g. via
 * `grocery-providers/registry.ts` + `request.country`) — this function has no flag or country
 * awareness itself, matching the pattern established in `engine.ts` (ADR-0017).
 */
export function buildGroceryList(
  recipes: GeneratedRecipe[],
  provider: GroceryPriceProvider = INDIA_GROCERY_PROVIDER,
): GroceryItem[] {
  const aggregated = new Map<string, { grams: number; unit: string }>();

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = ing.name.toLowerCase().trim();
      const grams = ing.totalGrams > 0 ? ing.totalGrams : toGrams(ing.quantity, ing.unit);
      const existing = aggregated.get(key);
      if (existing) {
        existing.grams += grams;
      } else {
        aggregated.set(key, { grams, unit: 'g' });
      }
    }
  }

  const items: GroceryItem[] = [];
  for (const [name, { grams }] of aggregated) {
    const kg = grams / 1000;
    const displayKg = Math.round(kg * 100) / 100;
    items.push({
      name,
      quantity:       displayKg >= 0.1 ? displayKg : Math.round(grams),
      unit:           displayKg >= 0.1 ? 'kg' : 'g',
      category:       categoriseIngredient(name, provider),
      estimatedPrice: estimatePrice(name, kg, provider),
      currencyCode:   provider.currencyCode,
    });
  }

  return items.sort((a, b) =>
    provider.categoryOrder.indexOf(a.category) - provider.categoryOrder.indexOf(b.category),
  );
}

/** Persist grocery list + items to database. */
export async function saveGroceryList(opts: {
  userId:      string;
  title:       string;
  mealPlanId?: string;
  items:       GroceryItem[];
  supabase:    SupabaseClient;
}): Promise<string> {
  const { userId, title, mealPlanId, items, supabase } = opts;

  const { data: list, error } = await supabase
    .from('grocery_lists')
    .insert({ user_id: userId, title, meal_plan_id: mealPlanId ?? null })
    .select('id')
    .single();

  if (error || !list) throw new Error(`saveGroceryList: ${error?.message}`);

  const listId = list.id as string;
  await supabase.from('grocery_items').insert(
    items.map((item) => ({
      grocery_list_id: listId,
      user_id:         userId,
      name:             item.name,
      quantity:         item.quantity,
      unit:             item.unit,
      category:         item.category,
      estimated_price:  item.estimatedPrice ?? null,
      currency_code:    item.currencyCode ?? 'INR',
    })),
  );

  return listId;
}

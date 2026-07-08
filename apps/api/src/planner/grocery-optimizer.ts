// Smart grocery list optimizer.
// Aggregates ingredients across all meals in a plan, deduplicates, estimates cost.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedRecipe, RecipeIngredient } from '../restaurant/recipe-generator.js';

export interface GroceryItem {
  name:         string;
  quantity:     number;
  unit:         string;
  category:     string;
  estimatedRs?: number;
}

// Approximate retail prices for common Indian grocery items (INR/kg or INR/litre)
const PRICE_PER_KG: Record<string, number> = {
  // Grains
  'rice':       60,    'atta':       45,   'maida':      40,
  'poha':       70,    'oats':      120,   'dalia':      80,
  // Lentils
  'dal':        90,    'chana':     100,   'rajma':     130,
  'moong':     100,    'urad':      110,   'masoor':     90,
  // Dairy
  'paneer':    400,    'milk':       60,   'curd':       60,
  'ghee':     600,     'butter':    500,
  // Vegetables (approximate)
  'onion':      30,    'tomato':     40,   'potato':     35,
  'spinach':    40,    'methi':      30,   'cauliflower':50,
  'capsicum':   80,    'carrot':     50,   'beans':      70,
  'peas':       60,    'brinjal':    40,
  // Oil
  'oil':       130,    'mustard oil':160,
  // Spices (per 100g)
  'garam masala':  300 / 10, // ₹300/kg → ₹30/100g
  'cumin':         400 / 10,
  'coriander':     200 / 10,
  'turmeric':      200 / 10,
  'chilli':        300 / 10,
  // Protein
  'chicken':   300,    'eggs':       80,
  // Nuts
  'peanuts':   120,    'cashews':   900,  'almonds': 1200,
  'makhana':   700,
};

// Category mappings
const CATEGORY_MAP: Record<string, string> = {
  'rice': 'grains', 'atta': 'grains', 'maida': 'grains', 'poha': 'grains',
  'oats': 'grains', 'dalia': 'grains',
  'dal': 'legumes', 'chana': 'legumes', 'rajma': 'legumes', 'moong': 'legumes',
  'urad': 'legumes', 'masoor': 'legumes', 'peas': 'legumes',
  'paneer': 'dairy', 'milk': 'dairy', 'curd': 'dairy',
  'ghee': 'dairy', 'butter': 'dairy',
  'onion': 'produce', 'tomato': 'produce', 'potato': 'produce',
  'spinach': 'produce', 'methi': 'produce', 'cauliflower': 'produce',
  'capsicum': 'produce', 'carrot': 'produce', 'beans': 'produce',
  'brinjal': 'produce',
  'oil': 'oil', 'mustard oil': 'oil',
  'chicken': 'protein', 'eggs': 'protein',
  'peanuts': 'nuts', 'cashews': 'nuts', 'almonds': 'nuts', 'makhana': 'nuts',
};

function categoriseIngredient(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return cat;
  }
  return 'spices';
}

function estimatePrice(name: string, quantityKg: number): number {
  const lower = name.toLowerCase();
  for (const [key, pricePerKg] of Object.entries(PRICE_PER_KG)) {
    if (lower.includes(key)) return Math.round(pricePerKg * quantityKg);
  }
  return Math.round(50 * quantityKg); // ₹50/kg default
}

type UnitKey = 'g' | 'ml' | 'kg' | 'l' | 'tsp' | 'tbsp' | 'cup';
const TO_GRAMS: Record<UnitKey, number> = {
  'g': 1, 'ml': 1, 'kg': 1000, 'l': 1000, 'tsp': 5, 'tbsp': 15, 'cup': 240,
};

function toGrams(quantity: number, unit: string): number {
  const factor = TO_GRAMS[unit.toLowerCase() as UnitKey] ?? 100;
  return quantity * factor;
}

/** Aggregate all recipe ingredients into a single shopping list. */
export function buildGroceryList(recipes: GeneratedRecipe[]): GroceryItem[] {
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
      quantity:    displayKg >= 0.1 ? displayKg : Math.round(grams),
      unit:        displayKg >= 0.1 ? 'kg' : 'g',
      category:    categoriseIngredient(name),
      estimatedRs: estimatePrice(name, kg),
    });
  }

  // Sort by category for shopping convenience
  const CATEGORY_ORDER = ['produce', 'dairy', 'protein', 'legumes', 'grains', 'oil', 'nuts', 'spices'];
  return items.sort((a, b) =>
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
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
      name:            item.name,
      quantity:        item.quantity,
      unit:            item.unit,
      category:        item.category,
      estimated_rs:    item.estimatedRs ?? null,
    })),
  );

  return listId;
}

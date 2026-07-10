// grocery.list / grocery.price_history — Phase 13 (§16.3). grocery.list wraps
// planner/grocery-optimizer.ts (buildGroceryList/saveGroceryList) unchanged. grocery.price_history
// queries REAL receipt-parsed prices from `pantry_items.estimated_rs` (populated by
// pantry/receipt-ocr.ts's parseAndSavePantryItems from actual scanned receipts) — the addendum's
// price-honesty rule ("prices ONLY from receipt history / community data / partner adapters —
// never invented") means this tool returns an EMPTY result, not a guessed number, when no receipt
// history exists for an ingredient.

import type { ToolDefinition, ToolContext } from '../types.js';
import { buildGroceryList, saveGroceryList, type GroceryItem } from '../../planner/grocery-optimizer.js';
import type { GeneratedRecipe } from '../../restaurant/recipe-generator.js';
import type { GroceryPriceProvider } from '../../planner/grocery-providers/types.js';

export type GroceryListInput = {
  title: string;
  provider?: GroceryPriceProvider;
} & (
  | { recipes: GeneratedRecipe[]; mealPlanId?: string }
  // Sources recipes from an already-generated, persisted plan's meal_plan_items.recipe_data
  // (real GeneratedRecipe JSON when the recipe generator's LLM path produced it — meal-plan-
  // generator.ts's generateMeal() sets recipeData to the LLM's real recipe object, `{}` only in
  // its own no-gateway fallback) — a natural extension of "wraps grocery-optimizer.ts", not a
  // new tool: the Grocery Agent's own flow (§16.4.3) starts from "plan/pantry diff," and a plan
  // is exactly what mealPlanId identifies.
  | { mealPlanId: string }
);

export interface GroceryListOutput {
  listId: string;
  items: GroceryItem[];
  recipesSourced: number;
}

async function resolveRecipes(input: GroceryListInput, ctx: ToolContext): Promise<GeneratedRecipe[]> {
  if ('recipes' in input) return input.recipes;

  const { data, error } = await ctx.supabase
    .from('meal_plan_items')
    .select('recipe_data')
    .eq('meal_plan_id', input.mealPlanId)
    .eq('user_id', ctx.userId);
  if (error) throw new Error(`grocery.list: failed to load meal plan items: ${error.message}`);

  return ((data ?? []) as Array<{ recipe_data: unknown }>)
    .map((row) => row.recipe_data as Partial<GeneratedRecipe>)
    .filter((r): r is GeneratedRecipe => Array.isArray(r.ingredients) && r.ingredients.length > 0);
}

export const groceryListTool: ToolDefinition<GroceryListInput, GroceryListOutput> = {
  name: 'grocery.list',
  description: 'Aggregate recipe ingredients (from an explicit recipe list OR an existing meal plan) into a deduplicated, categorized, priced shopping list and persist it.',
  execute: async (input, ctx) => {
    const recipes = await resolveRecipes(input, ctx);
    const items = buildGroceryList(recipes, input.provider);
    const mealPlanId = 'mealPlanId' in input ? input.mealPlanId : undefined;
    const listId = await saveGroceryList({
      userId: ctx.userId,
      title: input.title,
      mealPlanId,
      items,
      supabase: ctx.supabase,
    });
    return { listId, items, recipesSourced: recipes.length };
  },
};

export interface GroceryPriceHistoryInput {
  ingredientName: string;
  /** How far back to look, in days. */
  lookbackDays?: number;
}

export interface GroceryPriceHistoryEntry {
  priceRs: number;
  purchaseDate: string;
  source: string;
}

export interface GroceryPriceHistoryOutput {
  ingredientName: string;
  entries: GroceryPriceHistoryEntry[];
  /** Real average of the entries above — null (not 0, not a guess) when there is no history. */
  averagePriceRs: number | null;
}

export const groceryPriceHistoryTool: ToolDefinition<GroceryPriceHistoryInput, GroceryPriceHistoryOutput> = {
  name: 'grocery.price_history',
  description: 'Real historical prices for an ingredient, from the user\'s own scanned receipts only. Returns an empty result (never a guessed price) when no receipt history exists.',
  execute: async (input, ctx) => {
    const lookbackDays = input.lookbackDays ?? 90;
    const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString().slice(0, 10);

    const { data, error } = await ctx.supabase
      .from('pantry_items')
      .select('estimated_rs, purchase_date, source')
      .eq('user_id', ctx.userId)
      .ilike('name', `%${input.ingredientName}%`)
      .not('estimated_rs', 'is', null)
      .gte('purchase_date', since)
      .order('purchase_date', { ascending: false });

    if (error) throw new Error(`grocery.price_history: ${error.message}`);

    const rows = (data ?? []) as Array<{ estimated_rs: number; purchase_date: string; source: string }>;
    const entries: GroceryPriceHistoryEntry[] = rows.map((r) => ({
      priceRs: r.estimated_rs,
      purchaseDate: r.purchase_date,
      source: r.source,
    }));

    const averagePriceRs = entries.length > 0
      ? Math.round((entries.reduce((sum, e) => sum + e.priceRs, 0) / entries.length) * 100) / 100
      : null;

    return { ingredientName: input.ingredientName, entries, averagePriceRs };
  },
};

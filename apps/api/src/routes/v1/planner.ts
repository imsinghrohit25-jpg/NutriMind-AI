// Meal Planner + Smart Grocery Planner routes.

import type { FastifyInstance } from 'fastify';
import { generateAndSaveMealPlan } from '../../planner/meal-plan-generator.js';
import { buildGroceryList, saveGroceryList } from '../../planner/grocery-optimizer.js';
import type { GeneratedRecipe } from '../../restaurant/recipe-generator.js';

export async function plannerRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Generate AI meal plan ─────────────────────────────────────────────────
  fastify.post('/api/v1/planner/generate', async (request, reply) => {
    const user = (request as any).user as { id: string };
    const body = request.body as {
      title?:          string;
      startDate:       string;
      durationDays?:   number;
      kcalTarget:      number;
      proteinTarget?:  number;
      dietType?:       string;
      allergens?:      string[];
    };

    const durationDays = Math.min(body.durationDays ?? 7, 30); // cap at 30

    const { planId, days, warnings } = await generateAndSaveMealPlan({
      userId:    user.id,
      title:     body.title ?? `Meal Plan ${body.startDate}`,
      startDate: body.startDate,
      constraints: {
        kcalTarget:    body.kcalTarget,
        proteinTarget: body.proteinTarget ?? 0,
        dietType:      (body.dietType as any) ?? 'vegetarian',
        allergens:     body.allergens ?? [],
        durationDays,
      },
      gateway:  (fastify as any).gateway,
      supabase: (fastify as any).supabase,
    });

    reply.status(201).send({ planId, days, warnings });
  });

  // ── List meal plans ───────────────────────────────────────────────────────
  fastify.get('/api/v1/planner/plans', async (request, reply) => {
    const user    = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;

    const { data, error } = await supabase
      .from('meal_plans')
      .select('id, title, start_date, end_date, diet_type, kcal_target, status, generated_by, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ plans: data });
  });

  // ── Get single plan with items ─────────────────────────────────────────────
  fastify.get<{ Params: { planId: string } }>('/api/v1/planner/plans/:planId', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const { planId } = request.params;

    const { data: plan, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (error || !plan) return reply.status(404).send({ error: 'Plan not found' });

    const { data: items } = await supabase
      .from('meal_plan_items')
      .select('*')
      .eq('meal_plan_id', planId)
      .order('plan_date')
      .order('meal_type');

    reply.send({ plan, items });
  });

  // ── Mark meal complete ─────────────────────────────────────────────────────
  fastify.patch<{ Params: { itemId: string } }>('/api/v1/planner/items/:itemId/complete', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const { data, error } = await supabase
      .from('meal_plan_items')
      .update({ is_complete: true })
      .eq('id', request.params.itemId)
      .eq('user_id', user.id)
      .select('id')
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Item not found' });
    reply.send({ ok: true });
  });

  // ── Generate grocery list from plan ───────────────────────────────────────
  fastify.post<{ Params: { planId: string } }>('/api/v1/planner/plans/:planId/grocery', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const { planId } = request.params;

    const { data: plan, error: planErr } = await supabase
      .from('meal_plans')
      .select('id, title')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (planErr || !plan) return reply.status(404).send({ error: 'Plan not found' });

    // Collect all recipe_data JSONs from meal plan items
    const { data: items, error: itemErr } = await supabase
      .from('meal_plan_items')
      .select('recipe_data')
      .eq('meal_plan_id', planId);

    if (itemErr) return reply.status(500).send({ error: itemErr.message });

    const recipes: GeneratedRecipe[] = (items ?? [])
      .map((i: any) => i.recipe_data as GeneratedRecipe)
      .filter((r: GeneratedRecipe) => r?.ingredients?.length > 0);

    const groceryItems = buildGroceryList(recipes);
    const totalEstimatedPrice = groceryItems.reduce((s, i) => s + (i.estimatedPrice ?? 0), 0);
    const currencyCode = groceryItems[0]?.currencyCode ?? 'INR';

    const listId = await saveGroceryList({
      userId:      user.id,
      title:       `Grocery — ${(plan as any).title}`,
      mealPlanId:  planId,
      items:       groceryItems,
      supabase,
    });

    reply.status(201).send({ listId, items: groceryItems, totalEstimatedPrice, currencyCode });
  });

  // ── Get grocery list ───────────────────────────────────────────────────────
  fastify.get<{ Params: { listId: string } }>('/api/v1/planner/grocery/:listId', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;

    const { data: list, error } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('id', request.params.listId)
      .eq('user_id', user.id)
      .single();

    if (error || !list) return reply.status(404).send({ error: 'List not found' });

    const { data: items } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('grocery_list_id', request.params.listId)
      .order('category');

    reply.send({ list, items });
  });

  // ── Toggle grocery item purchased ─────────────────────────────────────────
  fastify.patch<{ Params: { itemId: string } }>('/api/v1/planner/grocery/items/:itemId/toggle', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;

    const { data: existing } = await supabase
      .from('grocery_items')
      .select('is_purchased')
      .eq('id', request.params.itemId)
      .eq('user_id', user.id)
      .single();

    if (!existing) return reply.status(404).send({ error: 'Item not found' });

    await supabase
      .from('grocery_items')
      .update({ is_purchased: !(existing as any).is_purchased })
      .eq('id', request.params.itemId);

    reply.send({ ok: true });
  });
}

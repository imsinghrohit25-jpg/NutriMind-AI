// Meal Planner + Smart Grocery Planner routes.
// Registered with prefix '/v1' in routes/v1/index.ts — real reachable paths are
// `/v1/planner/*` (this file previously hardcoded `/api/v1/planner/*`, which never resolved to
// anything real, and read `request.user` without a null guard — an unauthenticated request
// would throw instead of 401; see ADR-0022).

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { generateAndSaveMealPlan } from '../../planner/meal-plan-generator.js';
import { buildGroceryList, saveGroceryList } from '../../planner/grocery-optimizer.js';
import type { GeneratedRecipe } from '../../restaurant/recipe-generator.js';
import { recordEventBestEffort } from '../../memory/events.js';

export default async function plannerRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Generate AI meal plan ─────────────────────────────────────────────────
  fastify.post('/planner/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const body = request.body as {
      title?:          string;
      startDate:       string;
      durationDays?:   number;
      kcalTarget:      number;
      proteinTarget?:  number;
      dietType?:       string;
      allergens?:      string[];
    };

    if (!fastify.gateway) {
      return reply.status(503).send({ error: 'AI gateway not configured; set at least one LLM provider key' });
    }

    const durationDays = Math.min(body.durationDays ?? 7, 30); // cap at 30

    const { planId, days, warnings } = await generateAndSaveMealPlan({
      userId:    request.user.id,
      title:     body.title ?? `Meal Plan ${body.startDate}`,
      startDate: body.startDate,
      constraints: {
        kcalTarget:    body.kcalTarget,
        proteinTarget: body.proteinTarget ?? 0,
        dietType:      (body.dietType as any) ?? 'vegetarian',
        allergens:     body.allergens ?? [],
        durationDays,
      },
      gateway:  fastify.gateway,
      supabase: fastify.supabase,
    });

    // Phase 11 (AI Memory System, Layer 1) — one event per planned meal, best-effort.
    for (const day of days) {
      const meals = [day.breakfast, day.lunch, day.dinner, day.snack].filter((m) => m != null);
      for (const meal of meals) {
        recordEventBestEffort(fastify.supabase, request.user.id, 'meal_planned', {
          planId,
          mealType: meal.mealType,
          recipeName: meal.recipeName,
        });
      }
    }

    reply.status(201).send({ planId, days, warnings });
  });

  // ── List meal plans ───────────────────────────────────────────────────────
  fastify.get('/planner/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const { data, error } = await fastify.supabase
      .from('meal_plans')
      .select('id, title, start_date, end_date, diet_type, kcal_target, status, generated_by, created_at')
      .eq('user_id', request.user.id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ plans: data });
  });

  // ── Get single plan with items ─────────────────────────────────────────────
  fastify.get<{ Params: { planId: string } }>('/planner/plans/:planId', async (request, reply) => {
    requireAuth(request);
    const { planId } = request.params;

    const { data: plan, error } = await fastify.supabase
      .from('meal_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', request.user.id)
      .single();

    if (error || !plan) return reply.status(404).send({ error: 'Plan not found' });

    const { data: items } = await fastify.supabase
      .from('meal_plan_items')
      .select('*')
      .eq('meal_plan_id', planId)
      .order('plan_date')
      .order('meal_type');

    reply.send({ plan, items });
  });

  // ── Mark meal complete ─────────────────────────────────────────────────────
  fastify.patch<{ Params: { itemId: string } }>('/planner/items/:itemId/complete', async (request, reply) => {
    requireAuth(request);
    const { data, error } = await fastify.supabase
      .from('meal_plan_items')
      .update({ is_complete: true })
      .eq('id', request.params.itemId)
      .eq('user_id', request.user.id)
      .select('id, recipe_name, meal_type')
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Item not found' });

    // Phase 11 (AI Memory System, Layer 1) — marking a planned meal complete is the real
    // "this was actually cooked/eaten" signal; best-effort, never blocks the response.
    const completed = data as { recipe_name: string; meal_type: string };
    recordEventBestEffort(fastify.supabase, request.user.id, 'recipe_cooked', {
      recipeName: completed.recipe_name,
      mealType: completed.meal_type,
    });

    reply.send({ ok: true });
  });

  // ── Generate grocery list from plan ───────────────────────────────────────
  fastify.post<{ Params: { planId: string } }>('/planner/plans/:planId/grocery', async (request, reply) => {
    requireAuth(request);
    const { planId } = request.params;

    const { data: plan, error: planErr } = await fastify.supabase
      .from('meal_plans')
      .select('id, title')
      .eq('id', planId)
      .eq('user_id', request.user.id)
      .single();

    if (planErr || !plan) return reply.status(404).send({ error: 'Plan not found' });

    // Collect all recipe_data JSONs from meal plan items
    const { data: items, error: itemErr } = await fastify.supabase
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
      userId:      request.user.id,
      title:       `Grocery — ${(plan as any).title}`,
      mealPlanId:  planId,
      items:       groceryItems,
      supabase:    fastify.supabase,
    });

    reply.status(201).send({ listId, items: groceryItems, totalEstimatedPrice, currencyCode });
  });

  // ── Get grocery list ───────────────────────────────────────────────────────
  fastify.get<{ Params: { listId: string } }>('/planner/grocery/:listId', async (request, reply) => {
    requireAuth(request);
    const { data: list, error } = await fastify.supabase
      .from('grocery_lists')
      .select('*')
      .eq('id', request.params.listId)
      .eq('user_id', request.user.id)
      .single();

    if (error || !list) return reply.status(404).send({ error: 'List not found' });

    const { data: items } = await fastify.supabase
      .from('grocery_items')
      .select('*')
      .eq('grocery_list_id', request.params.listId)
      .order('category');

    reply.send({ list, items });
  });

  // ── Toggle grocery item purchased ─────────────────────────────────────────
  fastify.patch<{ Params: { itemId: string } }>('/planner/grocery/items/:itemId/toggle', async (request, reply) => {
    requireAuth(request);
    const { data: existing } = await fastify.supabase
      .from('grocery_items')
      .select('is_purchased, name, estimated_price, currency_code')
      .eq('id', request.params.itemId)
      .eq('user_id', request.user.id)
      .single();

    if (!existing) return reply.status(404).send({ error: 'Item not found' });

    const nowPurchased = !(existing as any).is_purchased;

    // Repeat the ownership filter on the write itself (defense in depth — the preceding SELECT
    // already 404s for another user's item, but the UPDATE shouldn't rely on that alone).
    await fastify.supabase
      .from('grocery_items')
      .update({ is_purchased: nowPurchased })
      .eq('id', request.params.itemId)
      .eq('user_id', request.user.id);

    // Phase 11 (AI Memory System, Layer 1) — only the un-purchased→purchased transition is a
    // real "grocery_purchase" event; toggling back off isn't an un-purchase in real life.
    if (nowPurchased) {
      const item = existing as { name: string; estimated_price: number | null; currency_code: string };
      recordEventBestEffort(fastify.supabase, request.user.id, 'grocery_purchase', {
        itemName: item.name,
        estimatedPrice: item.estimated_price ?? undefined,
        currencyCode: item.currency_code,
      });
    }

    reply.send({ ok: true });
  });
}

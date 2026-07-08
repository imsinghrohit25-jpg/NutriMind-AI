// Restaurant intelligence + recipe generator routes — Phase 16.
// Registered with prefix '/v1' in routes/v1/index.ts — real reachable paths are
// `/v1/restaurant/*` (this file previously hardcoded `/api/v1/restaurant/*`, which never
// resolved to anything real, and read a non-existent `req.userId`, so both handlers always
// 401'd; see ADR-0022).
// POST /v1/restaurant/menu/scan   — OCR text → structured menu + scoring
// POST /v1/restaurant/recipe/generate — generate AI recipe with nutrition

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { scanMenuText, scoreMenuItemForUser, estimateMenuItemNutrition } from '../../restaurant/menu-scanner.js';
import { generateRecipe } from '../../restaurant/recipe-generator.js';
import type { DietType, Cuisine } from '../../restaurant/recipe-generator.js';

export default async function restaurantRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Menu scan ─────────────────────────────────────────────────────────────
  fastify.post('/restaurant/menu/scan', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const body = req.body as { text: string; isVeg?: boolean; allergens?: string[] };
    if (!body?.text?.trim()) return reply.code(400).send({ error: 'text required' });

    // Fetch user preferences from profile. `users_profiles`'s PK IS the user id (migration
    // 0002) — no separate `user_id` column — and the real diet/allergen columns are
    // `diet_type`/`allergens` (not `dietary_preference`/`allergen_profile`, which never existed).
    let isVeg     = body.isVeg ?? false;
    let allergens = body.allergens ?? [];

    const { data: profile } = await fastify.supabase
      .from('users_profiles')
      .select('diet_type, allergens')
      .eq('id', userId)
      .single();

    if (profile) {
      isVeg     = (profile.diet_type as string)?.includes('veg') ?? isVeg;
      allergens = (profile.allergens as string[]) ?? allergens;
    }

    if (!fastify.gateway) {
      return reply.status(503).send({ error: 'AI gateway not configured; set at least one LLM provider key' });
    }
    const scan = await scanMenuText({ text: body.text, gateway: fastify.gateway });

    const scoredItems = scan.items.map((item) => ({
      ...item,
      score: scoreMenuItemForUser({
        item, userSodiumGoal: 2000, isVeg, allergens,
      }),
      nutritionEstimate: estimateMenuItemNutrition(item),
    }));

    return reply.send({
      restaurantName: scan.restaurantName,
      cuisine:        scan.cuisine,
      confidence:     scan.confidence,
      items:          scoredItems,
    });
  });

  // ── Recipe generator ──────────────────────────────────────────────────────
  fastify.post('/restaurant/recipe/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    requireAuth(req);
    const userId = req.user.id;

    const body = req.body as {
      prompt:    string;
      servings?: number;
      dietType?: DietType;
      cuisine?:  Cuisine;
      maxKcal?:  number;
      allergens?: string[];
    };

    if (!body?.prompt?.trim()) return reply.code(400).send({ error: 'prompt required' });

    // Load user's declared allergens — same users_profiles.id/allergens fix as menu/scan above.
    let allergens = body.allergens ?? [];
    const { data: profile } = await fastify.supabase
      .from('users_profiles')
      .select('allergens, diet_type')
      .eq('id', userId)
      .single();

    if (profile) {
      allergens = [...new Set([...allergens, ...((profile.allergens as string[]) ?? [])])];
    }

    if (!fastify.gateway) {
      return reply.status(503).send({ error: 'AI gateway not configured; set at least one LLM provider key' });
    }

    const recipe = await generateRecipe({
      prompt:   body.prompt,
      servings: body.servings ?? 2,
      dietType: body.dietType ?? 'vegetarian',
      cuisine:  body.cuisine,
      allergens,
      maxKcal:  body.maxKcal,
      gateway:  fastify.gateway,
      supabase: fastify.supabase,
    });

    return reply.send(recipe);
  });
}

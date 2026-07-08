// Restaurant intelligence + recipe generator routes — Phase 16.
// POST /api/v1/restaurant/menu/scan   — OCR text → structured menu + scoring
// POST /api/v1/restaurant/recipe/generate — generate AI recipe with nutrition

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../../gateway/router.js';
import { scanMenuText, scoreMenuItemForUser } from '../../restaurant/menu-scanner.js';
import { generateRecipe } from '../../restaurant/recipe-generator.js';
import type { DietType, Cuisine } from '../../restaurant/recipe-generator.js';

type AuthedRequest = FastifyRequest & { userId?: string };

export async function registerRestaurantRoutes(
  fastify:  FastifyInstance,
  supabase: SupabaseClient,
  gateway:  GatewayRouter,
): Promise<void> {

  // ── Menu scan ─────────────────────────────────────────────────────────────
  fastify.post('/api/v1/restaurant/menu/scan', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const body = req.body as { text: string; isVeg?: boolean; allergens?: string[] };
    if (!body?.text?.trim()) return reply.code(400).send({ error: 'text required' });

    // Fetch user preferences from profile
    let isVeg     = body.isVeg ?? false;
    let allergens = body.allergens ?? [];

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('dietary_preference, allergen_profile')
      .eq('user_id', userId)
      .single();

    if (profile) {
      isVeg     = (profile.dietary_preference as string)?.includes('veg') ?? isVeg;
      allergens = (profile.allergen_profile as string[]) ?? allergens;
    }

    const scan = await scanMenuText({ text: body.text, gateway });

    const scoredItems = scan.items.map((item) => ({
      ...item,
      score: scoreMenuItemForUser({
        item, userSodiumGoal: 2000, isVeg, allergens,
      }),
    }));

    return reply.send({
      restaurantName: scan.restaurantName,
      cuisine:        scan.cuisine,
      confidence:     scan.confidence,
      items:          scoredItems,
    });
  });

  // ── Recipe generator ──────────────────────────────────────────────────────
  fastify.post('/api/v1/restaurant/recipe/generate', async (req: AuthedRequest, reply: FastifyReply) => {
    const userId = req.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

    const body = req.body as {
      prompt:    string;
      servings?: number;
      dietType?: DietType;
      cuisine?:  Cuisine;
      maxKcal?:  number;
      allergens?: string[];
    };

    if (!body?.prompt?.trim()) return reply.code(400).send({ error: 'prompt required' });

    // Load user's declared allergens
    let allergens = body.allergens ?? [];
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('allergen_profile, dietary_preference')
      .eq('user_id', userId)
      .single();

    if (profile) {
      allergens = [...new Set([...allergens, ...((profile.allergen_profile as string[]) ?? [])])];
    }

    const recipe = await generateRecipe({
      prompt:   body.prompt,
      servings: body.servings ?? 2,
      dietType: body.dietType ?? 'vegetarian',
      cuisine:  body.cuisine,
      allergens,
      maxKcal:  body.maxKcal,
      gateway,
      supabase,
    });

    return reply.send(recipe);
  });
}

// Meal-log routes — the food-diary data flow.
//   POST   /v1/meals            — log a meal entry (serving nutrition computed server-side from
//                                 the caller's already-resolved per-100g nutrition; never LLM).
//   GET    /v1/meals/day?date=  — a day's entries + aggregated total + gap report vs the user's
//                                 personalised budget (reuses engines/meals + personalization).
//   DELETE /v1/meals/:id        — remove one logged entry.
// Uses the existing `meal_logs` table (migration 0006) + RLS; the same deterministic engines the
// weekly-report job uses (no duplicated aggregation/mapping — see engines/meals/meal-log-mapping).

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, err } from '@nutrimind/shared';
import { requireAuth } from '../../plugins/auth.js';
import { aggregateDay } from '../../engines/meals/aggregate.js';
import { analyseGaps } from '../../engines/meals/gap-analysis.js';
import { mealLogRowToEntry, resolveUserDailyBudget } from '../../engines/meals/meal-log-mapping.js';
import { computeWeeklyReport } from '../../jobs/handlers/weekly-report.js';

const Per100gSchema = z.object({
  energyKcal: z.number().nullable().optional(),
  proteinG: z.number().nullable().optional(),
  fatTotalG: z.number().nullable().optional(),
  carbohydratesG: z.number().nullable().optional(),
  sugarsG: z.number().nullable().optional(),
  dietaryFiberG: z.number().nullable().optional(),
  sodiumMg: z.number().nullable().optional(),
});

const LogBodySchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']),
  foodName: z.string().min(1).max(200),
  productId: z.string().uuid().optional(),
  quantityG: z.number().positive().max(10000),
  portionDescription: z.string().max(120).optional(),
  // Per-100g nutrition from the caller's prior resolve/scan (real engine-resolved data, not LLM).
  nutritionPer100g: Per100gSchema,
  nutritionSource: z.string().max(60).optional(),
  isEstimated: z.boolean().optional(),
  loggedAt: z.string().datetime().optional(),
});

/** Scale a per-100g value to the logged serving grams. Null passes through (not analysed). */
function scaleToServing(value: number | null | undefined, grams: number): number | null {
  if (value == null) return null;
  return Math.round((value * grams) / 100 * 1000) / 1000;
}

function dayBounds(date: string): { start: string; end: string } {
  // meal_logs.logged_at is TIMESTAMPTZ; the weekly-report job already treats a bare date as a UTC
  // day boundary, so match that convention here.
  return { start: `${date}T00:00:00.000Z`, end: `${date}T23:59:59.999Z` };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Monday (UTC) of the week containing `now` — the in-progress week, for the live weekly view. */
function currentWeekStart(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default async function mealsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: unknown }>('/meals', async (request, reply) => {
    requireAuth(request);
    const parsed = LogBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', parsed.error.message));
    }
    const b = parsed.data;
    const g = b.quantityG;
    const n = b.nutritionPer100g;

    const { data, error } = await fastify.supabase
      .from('meal_logs')
      .insert({
        user_id: request.user.id,
        meal_type: b.mealType,
        food_name: b.foodName,
        product_id: b.productId ?? null,
        quantity_g: g,
        portion_description: b.portionDescription ?? null,
        energy_kcal: scaleToServing(n.energyKcal, g),
        protein_g: scaleToServing(n.proteinG, g),
        fat_total_g: scaleToServing(n.fatTotalG, g),
        carbohydrates_g: scaleToServing(n.carbohydratesG, g),
        sugars_g: scaleToServing(n.sugarsG, g),
        dietary_fiber_g: scaleToServing(n.dietaryFiberG, g),
        sodium_mg: scaleToServing(n.sodiumMg, g),
        nutrition_source: b.nutritionSource ?? null,
        is_estimated: b.isEstimated ?? false,
        logged_at: b.loggedAt ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      return reply.status(500).send(err('LOG_FAILED', error?.message ?? 'Could not log meal'));
    }
    return reply.send(ok({ id: data.id }));
  });

  fastify.get<{ Querystring: { date?: string } }>('/meals/day', async (request, reply) => {
    requireAuth(request);
    const date = request.query.date && ISO_DATE.test(request.query.date)
      ? request.query.date
      : new Date().toISOString().slice(0, 10);
    const { start, end } = dayBounds(date);

    const { data: rows } = await fastify.supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', request.user.id)
      .gte('logged_at', start)
      .lte('logged_at', end)
      .order('logged_at', { ascending: true });

    const logRows = rows ?? [];
    // Engine MealEntry shape (via the shared mapper) — feeds both aggregateDay and the meal-log
    // screen directly, so there is one entry representation, not two.
    const entries = logRows.map(mealLogRowToEntry);
    const total = aggregateDay(entries, date);
    const budget = await resolveUserDailyBudget(fastify.supabase, request.user.id);
    const gapReport = budget ? analyseGaps(total, budget, 'You') : null;

    return reply.send(ok({ date, entries, total, gapReport }));
  });

  // GET /v1/meals/weekly?weekStart=YYYY-MM-DD — the rendered weekly report (7-day averages, top
  // wins/concerns) for the requested week, defaulting to the current in-progress week. Reuses the
  // exact compute the pg-boss weekly-report job uses; `report` maps 1:1 onto WeeklyReportScreen.
  fastify.get<{ Querystring: { weekStart?: string } }>('/meals/weekly', async (request, reply) => {
    requireAuth(request);
    const weekStart = request.query.weekStart && ISO_DATE.test(request.query.weekStart)
      ? request.query.weekStart
      : currentWeekStart();

    const result = await computeWeeklyReport(fastify.supabase, request.user.id, weekStart, 'You');
    if (!result) {
      // No meals logged this week (or an incomplete profile) — an honest "nothing yet", not a
      // fabricated report.
      return reply.send(ok({ weekStart, available: false, report: null }));
    }
    return reply.send(ok({
      weekStart: result.weekStart,
      weekEnd: result.weekEnd,
      available: true,
      daysLogged: result.daysLogged,
      // WeeklyReportScreen reads headline / topWins / topConcerns / fibreSummary / sodiumSummary /
      // weekStart directly off `report`.
      report: { ...result.rendered, weekStart: result.weekStart },
      gapReport: result.gapReport,
      weeklyAvg: result.weeklyAvg,
    }));
  });

  fastify.delete<{ Params: { id: string } }>('/meals/:id', async (request, reply) => {
    requireAuth(request);
    const { error } = await fastify.supabase
      .from('meal_logs')
      .delete()
      .eq('id', request.params.id)
      .eq('user_id', request.user.id);
    if (error) {
      return reply.status(500).send(err('DELETE_FAILED', error.message));
    }
    return reply.send(ok({ deleted: true }));
  });
}

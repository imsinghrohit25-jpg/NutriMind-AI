import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import mealsRoutes from '../meals.js';

interface MockOpts {
  authenticated?: boolean;
  dayRows?: Record<string, unknown>[];
  profile?: Record<string, unknown> | null;
  deleteError?: { message: string } | null;
  onInsert?: (payload: Record<string, unknown>) => void;
}

// A complete profile → resolveUserDailyBudget returns a real budget; omit → gapReport is null.
const COMPLETE_PROFILE = {
  weight_kg: 70,
  height_cm: 175,
  age_years: 30,
  biological_sex: 'male',
  activity_level: 'moderately_active',
};

async function buildApp(opts: MockOpts): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('supabase', {
    from: vi.fn((table: string) => {
      if (table === 'meal_logs') {
        return {
          insert: (payload: Record<string, unknown>) => {
            opts.onInsert?.(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'meal-1' }, error: null }) }) };
          },
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => Promise.resolve({ data: opts.dayRows ?? [], error: null }),
                }),
              }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: opts.deleteError ?? null }),
            }),
          }),
        };
      }
      if (table === 'users_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: opts.profile ?? null, error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  } as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    if (opts.authenticated !== false) request.user = { id: 'user-1', role: 'authenticated' };
  });
  app.setErrorHandler((error, _req, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    reply.status(statusCode).send({ ok: false });
  });
  await app.register(mealsRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

const validBody = {
  mealType: 'lunch',
  foodName: 'Paneer curry',
  quantityG: 200,
  nutritionPer100g: { energyKcal: 250, proteinG: 8, sodiumMg: 300, carbohydratesG: 12 },
};

describe('POST /v1/meals', () => {
  it('401 when unauthenticated', async () => {
    const app = await buildApp({ authenticated: false });
    const resp = await app.inject({ method: 'POST', url: '/v1/meals', payload: validBody });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('logs an entry and scales per-100g nutrition to the serving grams server-side', async () => {
    let captured: Record<string, unknown> | undefined;
    const app = await buildApp({ onInsert: (p) => (captured = p) });
    const resp = await app.inject({ method: 'POST', url: '/v1/meals', payload: validBody });
    expect(resp.statusCode).toBe(200);
    expect(JSON.parse(resp.body).data.id).toBe('meal-1');
    // 250 kcal/100g × 200g = 500; 8g protein × 2 = 16; 300mg sodium × 2 = 600.
    expect(captured!.energy_kcal).toBe(500);
    expect(captured!.protein_g).toBe(16);
    expect(captured!.sodium_mg).toBe(600);
    expect(captured!.user_id).toBe('user-1');
    expect(captured!.meal_type).toBe('lunch');
    await app.close();
  });

  it('400 on an invalid body (bad meal_type / missing quantity)', async () => {
    const app = await buildApp({});
    const resp = await app.inject({ method: 'POST', url: '/v1/meals', payload: { mealType: 'brunch', foodName: 'x' } });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /v1/meals/day', () => {
  it('aggregates the day and returns a gap report against the user budget', async () => {
    const rows = [
      { id: 'a', food_name: 'Idli', logged_at: '2026-07-24T03:00:00Z', energy_kcal: 200, protein_g: 6, carbohydrates_g: 40, sodium_mg: 200, dietary_fiber_g: 2 },
      { id: 'b', food_name: 'Dal', logged_at: '2026-07-24T07:00:00Z', energy_kcal: 300, protein_g: 12, carbohydrates_g: 30, sodium_mg: 400, dietary_fiber_g: 5 },
    ];
    const app = await buildApp({ dayRows: rows, profile: COMPLETE_PROFILE });
    const resp = await app.inject({ method: 'GET', url: '/v1/meals/day?date=2026-07-24' });
    expect(resp.statusCode).toBe(200);
    const data = JSON.parse(resp.body).data;
    expect(data.total.energyKcal).toBe(500); // 200 + 300
    expect(data.total.proteinG).toBe(18);
    expect(data.entries).toHaveLength(2);
    expect(data.entries[0].productName).toBe('Idli');
    expect(data.entries[0].servingG).toBe(100); // absolute serving nutrition passes through
    expect(data.entries[0].nutrition.energyKcal).toBe(200);
    expect(data.gapReport).not.toBeNull();
    expect(data.gapReport.gaps.find((g: { nutrient: string }) => g.nutrient === 'Calories').consumed).toBe(500);
    await app.close();
  });

  it('empty day → zero totals, no crash, null gap report when profile incomplete', async () => {
    const app = await buildApp({ dayRows: [], profile: null });
    const resp = await app.inject({ method: 'GET', url: '/v1/meals/day' });
    expect(resp.statusCode).toBe(200);
    const data = JSON.parse(resp.body).data;
    expect(data.total.energyKcal).toBe(0);
    expect(data.entries).toHaveLength(0);
    expect(data.gapReport).toBeNull();
    await app.close();
  });
});

describe('DELETE /v1/meals/:id', () => {
  it('deletes an entry scoped to the caller', async () => {
    const app = await buildApp({});
    const resp = await app.inject({ method: 'DELETE', url: '/v1/meals/abc' });
    expect(resp.statusCode).toBe(200);
    expect(JSON.parse(resp.body).data.deleted).toBe(true);
    await app.close();
  });
});

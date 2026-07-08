// Route-level tests for restaurant.ts — previously queried a non-existent `user_profiles` table
// with non-existent `dietary_preference`/`allergen_profile` columns and read a non-existent
// `req.userId`, so both handlers always 401'd. See ADR-0022.

import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import restaurantRoutes from '../restaurant.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

function buildApp(opts: { profile?: { diet_type?: string; allergens?: string[] }; gateway?: unknown }): FastifyInstance {
  const app = Fastify({ logger: false });
  const supabase = { from: vi.fn(() => makeChainable({ data: opts.profile ?? null })) };
  app.decorate('supabase', supabase as never);
  app.decorate('gateway', (opts.gateway ?? null) as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers['x-test-user'];
    if (typeof header === 'string') request.user = { id: header, role: 'authenticated' };
  });
  (app as unknown as { _supabase: typeof supabase })._supabase = supabase;
  return app;
}

describe('restaurant routes', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const app = buildApp({});
    await app.register(restaurantRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({ method: 'POST', url: '/v1/restaurant/menu/scan', payload: { text: 'menu' } });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('queries users_profiles by id (not the non-existent user_profiles/user_id)', async () => {
    const app = buildApp({ profile: { diet_type: 'vegetarian', allergens: ['peanuts'] } });
    await app.register(restaurantRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/restaurant/menu/scan',
      headers: { 'x-test-user': 'user-1' },
      payload: { text: 'menu text' },
    });

    // No gateway configured in this test → 503, but the profile lookup ran first and used the
    // correct table/column, which is what this test is verifying.
    expect(resp.statusCode).toBe(503);
    const supabase = (app as unknown as { _supabase: { from: ReturnType<typeof vi.fn> } })._supabase;
    expect(supabase.from).toHaveBeenCalledWith('users_profiles');
    expect(supabase.from).not.toHaveBeenCalledWith('user_profiles');
    const chainable = supabase.from.mock.results[0]!.value;
    expect(chainable.select).toHaveBeenCalledWith('diet_type, allergens');
    expect(chainable.eq).toHaveBeenCalledWith('id', 'user-1');
    await app.close();
  });

  it('recipe/generate also queries users_profiles.id with allergens/diet_type columns', async () => {
    const app = buildApp({ profile: { allergens: ['dairy'] } });
    await app.register(restaurantRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/restaurant/recipe/generate',
      headers: { 'x-test-user': 'user-1' },
      payload: { prompt: 'high protein dinner' },
    });

    expect(resp.statusCode).toBe(503); // no gateway configured
    const supabase = (app as unknown as { _supabase: { from: ReturnType<typeof vi.fn> } })._supabase;
    expect(supabase.from).toHaveBeenCalledWith('users_profiles');
    await app.close();
  });

  it('rejects an empty text/prompt body with 400', async () => {
    const app = buildApp({});
    await app.register(restaurantRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/restaurant/menu/scan',
      headers: { 'x-test-user': 'user-1' },
      payload: { text: '' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });
});

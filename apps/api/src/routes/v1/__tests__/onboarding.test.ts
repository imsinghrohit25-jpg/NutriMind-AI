import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import onboardingRoutes from '../onboarding.js';
import { INDIA_PROFILE } from '../../../country/types.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

function buildApp(perTable: Record<string, { data?: unknown; error?: unknown }> = {}) {
  const app = Fastify({ logger: false });
  const supabase = { from: vi.fn((table: string) => makeChainable(perTable[table] ?? {})) };
  app.decorate('supabase', supabase as never);
  app.decorateRequest('user', null);
  app.decorateRequest('country', null as never);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers['x-test-user'];
    if (typeof header === 'string') request.user = { id: header, role: 'authenticated' };
    (request as unknown as { country: unknown }).country = INDIA_PROFILE;
  });
  return { app, supabase };
}

describe('onboarding routes', () => {
  it('GET /v1/onboarding/country returns the resolved suggestion + full country list, no auth required', async () => {
    const { app } = buildApp();
    await app.register(onboardingRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/onboarding/country' });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.suggested.isoCode).toBe('IN');
    expect(body.data.countries.length).toBeGreaterThanOrEqual(25);
    await app.close();
  });

  it('POST /v1/onboarding/country rejects with 401 when unauthenticated', async () => {
    const { app } = buildApp();
    await app.register(onboardingRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/onboarding/country', payload: { isoCode: 'GB' } });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('POST /v1/onboarding/country persists the choice and returns the resolved profile', async () => {
    const { app, supabase } = buildApp();
    await app.register(onboardingRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/country',
      headers: { 'x-test-user': 'user-1' },
      payload: { isoCode: 'GB' },
    });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.profile.isoCode).toBe('GB');
    expect(supabase.from).toHaveBeenCalledWith('users_profiles');
    const chainable = supabase.from.mock.results[0]!.value;
    expect(chainable.update).toHaveBeenCalledWith({ preferred_country: 'GB', detected_country: 'IN' });
    await app.close();
  });

  it('POST /v1/onboarding/country rejects an unknown country with 400', async () => {
    const { app } = buildApp();
    await app.register(onboardingRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/country',
      headers: { 'x-test-user': 'user-1' },
      payload: { isoCode: 'ZZ' },
    });
    expect(resp.statusCode).toBe(400);
    const body = JSON.parse(resp.body);
    expect(body.error.code).toBe('UNKNOWN_COUNTRY');
    await app.close();
  });

  it('rejects a malformed body with 400', async () => {
    const { app } = buildApp();
    await app.register(onboardingRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/country',
      headers: { 'x-test-user': 'user-1' },
      payload: { isoCode: '' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });
});

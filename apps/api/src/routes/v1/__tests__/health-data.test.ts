// Route-level tests for health-data.ts — previously hardcoded `/api/v1/health/*` paths, read a
// non-existent `req.userId` (every handler always 401'd), and took a 2-arg
// `(fastify, supabase)` signature `fastify.register()` cannot supply. See ADR-0022.

import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import healthDataRoutes from '../health-data.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'insert', 'update', 'delete', 'upsert']) {
    chain[m] = vi.fn(self);
  }
  chain.single = vi.fn(() => Promise.resolve(resolved));
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolved).then(onFulfilled);
  return chain;
}

function buildApp(perTable: Record<string, { data?: unknown; error?: unknown }> = {}) {
  const app = Fastify({ logger: false });
  const supabase = { from: vi.fn((table: string) => makeChainable(perTable[table] ?? { data: [] })) };
  app.decorate('supabase', supabase as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers['x-test-user'];
    if (typeof header === 'string') request.user = { id: header, role: 'authenticated' };
  });
  return { app, supabase };
}

describe('health-data routes', () => {
  it('registers successfully as a single-arg plugin (the pre-fix 2-arg signature would throw here)', async () => {
    const { app } = buildApp();
    await expect(app.register(healthDataRoutes, { prefix: '/v1' })).resolves.not.toThrow();
    await app.ready();
    await app.close();
  });

  it('rejects GET /v1/health/metrics with 401 when unauthenticated', async () => {
    const { app } = buildApp();
    await app.register(healthDataRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({ method: 'GET', url: '/v1/health/metrics' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('does not collide with the unrelated GET /v1/health health-check route', async () => {
    const { app } = buildApp();
    await app.register(healthDataRoutes, { prefix: '/v1' });
    await app.ready();
    // /v1/health/metrics and /v1/health (a different, separately-registered route file) must
    // both be independently routable — this only checks health-data.ts's own route resolves.
    expect(app.hasRoute({ method: 'GET', url: '/v1/health/metrics' })).toBe(true);
    await app.close();
  });

  it('lists health_metrics filtered by user at the real /v1 path', async () => {
    const { app, supabase } = buildApp({ health_metrics: { data: [{ metric_type: 'steps', value: 8000 }] } });
    await app.register(healthDataRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/health/metrics', headers: { 'x-test-user': 'user-1' } });
    expect(resp.statusCode).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('health_metrics');
    await app.close();
  });

  it('rejects the energy-adjustment endpoint with 400 on a non-numeric tdee (not NaN math)', async () => {
    const { app } = buildApp({ health_metrics: { data: [] } });
    await app.register(healthDataRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'GET',
      url: '/v1/health/energy-adjustment?tdee=not-a-number&activityLevel=sedentary',
      headers: { 'x-test-user': 'user-1' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('grant/revoke consent round-trips through health_consents/health_metrics', async () => {
    const { app, supabase } = buildApp({ health_consents: { data: [] }, health_metrics: { data: [] } });
    await app.register(healthDataRoutes, { prefix: '/v1' });
    await app.ready();

    const grantResp = await app.inject({
      method: 'POST',
      url: '/v1/health/consents/grant',
      headers: { 'x-test-user': 'user-1' },
      payload: { metricType: 'steps' },
    });
    expect(grantResp.statusCode).toBe(200);

    const revokeResp = await app.inject({
      method: 'POST',
      url: '/v1/health/consents/revoke',
      headers: { 'x-test-user': 'user-1' },
      payload: { metricType: 'steps' },
    });
    expect(revokeResp.statusCode).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('health_consents');
    await app.close();
  });
});

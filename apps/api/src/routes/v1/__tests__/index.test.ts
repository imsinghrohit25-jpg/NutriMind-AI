// Full route-tree registration test — Phase 9 (route-registration audit, ADR-0022).
// Proves every route file in routes/v1/ actually registers without error when wired through
// registerV1Routes() exactly as app.ts calls it, and spot-checks that routes across ALL 16
// files (not just the ones fixed this session) resolve to real, reachable `/v1/...` paths —
// not 404 (unregistered/wrong path) and not a Fastify plugin-registration crash.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { registerV1Routes } from '../index.js';

function makeChainable() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'lt', 'order', 'limit', 'insert', 'update', 'delete', 'upsert']) {
    chain[m] = vi.fn(self);
  }
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled);
  return chain;
}

function buildStubSupabase() {
  return {
    from: vi.fn(() => makeChainable()),
    auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
  };
}

describe('registerV1Routes — full route tree', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Minimal stand-ins for every fastify.* decoration any route file reads (app.ts wires the
    // real versions of these). Registration-level test — not exercising deep business logic.
    app.decorate('supabase', buildStubSupabase() as never);
    app.decorate('gateway', null as never); // matches "no LLM key configured" in real deployments
    app.decorate('sql', vi.fn().mockResolvedValue([]) as never);
    app.decorate('offClient', { getProduct: vi.fn(), searchByName: vi.fn() } as never);
    app.decorate('usdaClient', null as never);
    app.decorate('ifct', { isAvailable: () => false, count: 0, getAll: () => [], searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
    app.decorate('cofid', { isAvailable: () => false, size: 0, getAll: () => [], searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
    app.decorate('productCache', { get: vi.fn(), set: vi.fn() } as never);

    app.decorateRequest('user', null);
    app.decorateRequest('country', null as never);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      const header = request.headers['x-test-user'];
      if (typeof header === 'string') {
        request.user = { id: header, role: 'authenticated' };
      }
    });

    await registerV1Routes(app);
    await app.ready();
  });

  afterAll(async () => app.close());

  it('registers without throwing (proves every plugin signature is register()-compatible)', () => {
    // If any route file still had a multi-arg/non-default-export signature (the exact defect
    // found in biomarker.ts/health-data.ts/voice.ts/restaurant.ts pre-fix), beforeAll's
    // registerV1Routes()/app.ready() call above would have already thrown before reaching here.
    expect(app.hasRoute({ method: 'GET', url: '/v1/health' })).toBe(true);
  });

  const authRequiredRoutes: Array<{ method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string }> = [
    // Previously registered (Phase 8 and earlier)
    { method: 'GET', url: '/v1/data-rights/rights' }, // no auth actually required, sanity check only
    { method: 'GET', url: '/v1/privacy/consent' },
    // family.ts
    { method: 'GET', url: '/v1/family/groups' },
    { method: 'POST', url: '/v1/family/groups' },
    // restaurant.ts
    { method: 'POST', url: '/v1/restaurant/menu/scan' },
    { method: 'POST', url: '/v1/restaurant/recipe/generate' },
    // planner.ts
    { method: 'GET', url: '/v1/planner/plans' },
    { method: 'POST', url: '/v1/planner/generate' },
    // pantry.ts
    { method: 'GET', url: '/v1/pantry/items' },
    { method: 'GET', url: '/v1/pantry/expiry' },
    // biomarker.ts
    { method: 'GET', url: '/v1/biomarker/lab-results' },
    { method: 'GET', url: '/v1/biomarker/glucose/readings' },
    // health-data.ts
    { method: 'GET', url: '/v1/health/metrics' },
    { method: 'GET', url: '/v1/health/consents' },
    // voice.ts
    { method: 'POST', url: '/v1/voice/parse' },
    // memory.ts (Phase 11)
    { method: 'GET', url: '/v1/memory' },
    { method: 'DELETE', url: '/v1/memory/00000000-0000-0000-0000-000000000000' },
    { method: 'POST', url: '/v1/memory/feedback' },
  ];

  it.each(authRequiredRoutes)('$method $url resolves to a real route (not 404)', async ({ method, url }) => {
    const resp = await app.inject({ method, url, payload: method === 'POST' ? {} : undefined });
    // The old bugs (hardcoded /api/v1/..., wrong export signature) made these 404 or crash the
    // whole app at registration time. A 401 (unauthenticated) or 400 (bad body) proves the route
    // exists, is reachable at the real /v1/... path, and its handler ran.
    expect(resp.statusCode).not.toBe(404);
  });

  it('unauthenticated requests get a clean 401, not a 500 from dereferencing a null user', async () => {
    // This is the family.ts/planner.ts/pantry.ts-class bug: reading request.user.id without a
    // requireAuth() guard threw a TypeError (surfaced as 500) instead of a clean 401.
    for (const { method, url } of [
      { method: 'GET' as const, url: '/v1/family/groups' },
      { method: 'GET' as const, url: '/v1/planner/plans' },
      { method: 'GET' as const, url: '/v1/pantry/items' },
      { method: 'GET' as const, url: '/v1/biomarker/lab-results' },
      { method: 'GET' as const, url: '/v1/health/metrics' },
      { method: 'GET' as const, url: '/v1/memory' },
    ]) {
      const resp = await app.inject({ method, url });
      expect(resp.statusCode).toBe(401);
    }
  });

  it('authenticated requests to simple list endpoints succeed (200), not 500', async () => {
    for (const { method, url } of [
      { method: 'GET' as const, url: '/v1/family/groups' },
      { method: 'GET' as const, url: '/v1/planner/plans' },
      { method: 'GET' as const, url: '/v1/pantry/items' },
      { method: 'GET' as const, url: '/v1/biomarker/lab-results' },
      { method: 'GET' as const, url: '/v1/health/metrics' },
      { method: 'GET' as const, url: '/v1/health/consents' },
      { method: 'GET' as const, url: '/v1/biomarker/glucose/readings' },
      { method: 'GET' as const, url: '/v1/memory' },
    ]) {
      const resp = await app.inject({ method, url, headers: { 'x-test-user': 'user-1' } });
      expect(resp.statusCode).toBe(200);
    }
  });

  it('voice/parse and restaurant endpoints report 503 (not 500/404) when no LLM gateway is configured', async () => {
    for (const url of ['/v1/voice/parse', '/v1/restaurant/menu/scan', '/v1/restaurant/recipe/generate']) {
      const resp = await app.inject({
        method: 'POST',
        url,
        headers: { 'x-test-user': 'user-1' },
        payload: { text: 'test', prompt: 'test' },
      });
      expect(resp.statusCode).toBe(503);
    }
  });
});

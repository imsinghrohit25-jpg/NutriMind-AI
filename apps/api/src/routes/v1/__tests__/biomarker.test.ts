// Route-level tests for biomarker.ts — previously hardcoded `/api/v1/biomarker/*` paths, read a
// non-existent `req.userId` (every handler always 401'd), and took a 3-arg
// `(fastify, supabase, gateway)` signature `fastify.register()` cannot supply. See ADR-0022.

import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import biomarkerRoutes from '../biomarker.js';

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
  app.decorate('gateway', null as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers['x-test-user'];
    if (typeof header === 'string') request.user = { id: header, role: 'authenticated' };
  });
  return { app, supabase };
}

describe('biomarker routes', () => {
  it('registers successfully as a single-arg plugin (the pre-fix 3-arg signature would throw here)', async () => {
    const { app } = buildApp();
    await expect(app.register(biomarkerRoutes, { prefix: '/v1' })).resolves.not.toThrow();
    await app.ready();
    await app.close();
  });

  it('rejects GET /v1/biomarker/lab-results with 401 when unauthenticated', async () => {
    const { app } = buildApp();
    await app.register(biomarkerRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({ method: 'GET', url: '/v1/biomarker/lab-results' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('lists lab_results and flags them against biomarker_types at the real /v1 path', async () => {
    const { app, supabase } = buildApp({
      lab_results: { data: [{ biomarker_type: 'hba1c', value: 5.4 }] },
      biomarker_types: { data: [{ id: 'hba1c', display_name: 'HbA1c', unit: '%', normal_min: 4, normal_max: 5.6, panel: 'diabetes' }] },
    });
    await app.register(biomarkerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/biomarker/lab-results', headers: { 'x-test-user': 'user-1' } });
    expect(resp.statusCode).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('lab_results');
    expect(supabase.from).toHaveBeenCalledWith('biomarker_types');
    await app.close();
  });

  it('manual lab result entry validates required fields (400, not a crash)', async () => {
    const { app } = buildApp();
    await app.register(biomarkerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/biomarker/lab-results/manual',
      headers: { 'x-test-user': 'user-1' },
      payload: { biomarkerType: 'hba1c' }, // missing value/measuredAt
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('dexcom callback validates required fields before calling the OAuth exchange (400, not a crash)', async () => {
    const { app } = buildApp();
    await app.register(biomarkerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/biomarker/oauth/dexcom/callback',
      headers: { 'x-test-user': 'user-1' },
      payload: {}, // missing code/redirectUri/codeVerifier
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('disconnect dexcom deletes from oauth_tokens filtered by user and provider', async () => {
    const { app, supabase } = buildApp({ oauth_tokens: { data: null } });
    await app.register(biomarkerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'DELETE',
      url: '/v1/biomarker/oauth/dexcom',
      headers: { 'x-test-user': 'user-1' },
    });
    expect(resp.statusCode).toBe(200);
    const chainable = supabase.from.mock.results.find((r, i) => supabase.from.mock.calls[i]![0] === 'oauth_tokens')!.value;
    expect(chainable.delete).toHaveBeenCalled();
    expect(chainable.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chainable.eq).toHaveBeenCalledWith('provider', 'dexcom');
    await app.close();
  });
});

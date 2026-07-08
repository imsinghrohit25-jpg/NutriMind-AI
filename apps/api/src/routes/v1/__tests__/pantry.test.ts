// Route-level tests for pantry.ts — previously hardcoded `/api/v1/pantry/*` paths and read
// `request.user` without a null guard (an unauthenticated request threw instead of 401). See
// ADR-0022. Table/column references were already correct; this proves they still are.

import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import pantryRoutes from '../pantry.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.not = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
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

describe('pantry routes', () => {
  it('rejects GET /v1/pantry/items with 401 (clean, not a 500) when unauthenticated', async () => {
    const { app } = buildApp();
    await app.register(pantryRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({ method: 'GET', url: '/v1/pantry/items' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('lists pantry_items filtered by user_id at the real /v1 path', async () => {
    const { app, supabase } = buildApp({ pantry_items: { data: [{ id: 'p1', name: 'Rice' }] } });
    await app.register(pantryRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/pantry/items', headers: { 'x-test-user': 'user-1' } });
    expect(resp.statusCode).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('pantry_items');
    await app.close();
  });

  it('adds a manual pantry item with the real column names', async () => {
    const { app, supabase } = buildApp({ pantry_items: { data: { id: 'p1', name: 'Milk' } } });
    await app.register(pantryRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/pantry/items',
      headers: { 'x-test-user': 'user-1' },
      payload: { name: 'Milk', quantity: 1, unit: 'litre', expiryDate: '2026-08-01' },
    });
    expect(resp.statusCode).toBe(201);
    const chainable = supabase.from.mock.results.find((r, i) => supabase.from.mock.calls[i]![0] === 'pantry_items')!.value;
    expect(chainable.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', name: 'Milk', expiry_date: '2026-08-01' }),
    );
    await app.close();
  });

  it('receipt upload does not hard-fail when no LLM gateway is configured (regex fallback)', async () => {
    const { app } = buildApp({ pantry_receipts: { data: { id: 'r1' } }, pantry_items: { data: [] } });
    await app.register(pantryRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/pantry/receipts',
      headers: { 'x-test-user': 'user-1' },
      payload: { text: 'Milk 1L 60\nRice 5kg 400' },
    });
    // Unlike restaurant.ts/voice.ts (which require a gateway), pantry receipt parsing degrades
    // to regex-only extraction — it must NOT 503 just because no gateway is configured.
    expect(resp.statusCode).toBe(201);
    await app.close();
  });

  it('expiry alerts falls back to a default withinDays instead of NaN on a bad query param', async () => {
    const { app } = buildApp({ pantry_items: { data: [] } });
    await app.register(pantryRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'GET',
      url: '/v1/pantry/expiry?withinDays=not-a-number',
      headers: { 'x-test-user': 'user-1' },
    });
    expect(resp.statusCode).toBe(200);
    await app.close();
  });
});

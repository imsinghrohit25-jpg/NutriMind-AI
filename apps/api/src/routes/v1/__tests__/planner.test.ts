// Route-level tests for planner.ts — previously hardcoded `/api/v1/planner/*` paths and read
// `request.user` without a null guard (an unauthenticated request threw instead of 401). See
// ADR-0022. This also proves grocery_items queries use the post-migration-0020 `estimated_price`
// column (renamed from `estimated_rs`), which planner.ts's underlying grocery-optimizer.ts
// already used correctly, but was never actually exercised through a real route.

import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import plannerRoutes from '../planner.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'eq', 'order', 'insert', 'update', 'delete']) chain[m] = vi.fn(self);
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

describe('planner routes', () => {
  it('rejects GET /v1/planner/plans with 401 (clean, not a 500) when unauthenticated', async () => {
    const { app } = buildApp();
    await app.register(plannerRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({ method: 'GET', url: '/v1/planner/plans' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('lists meal_plans at the real /v1 path', async () => {
    const { app, supabase } = buildApp({ meal_plans: { data: [{ id: 'plan-1', title: 'Week 1' }] } });
    await app.register(plannerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/planner/plans', headers: { 'x-test-user': 'user-1' } });
    expect(resp.statusCode).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('meal_plans');
    await app.close();
  });

  it('generate returns 503 when no LLM gateway is configured (required, unlike pantry receipts)', async () => {
    const { app } = buildApp();
    await app.register(plannerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/planner/generate',
      headers: { 'x-test-user': 'user-1' },
      payload: { startDate: '2026-08-01', kcalTarget: 2000 },
    });
    expect(resp.statusCode).toBe(503);
    await app.close();
  });

  it('grocery list read queries grocery_items (post-migration-0020 schema)', async () => {
    const { app, supabase } = buildApp({
      grocery_lists: { data: { id: 'list-1', title: 'Groceries' } },
      grocery_items: { data: [{ id: 'i1', estimated_price: 45.5, currency_code: 'INR' }] },
    });
    await app.register(plannerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'GET',
      url: '/v1/planner/grocery/list-1',
      headers: { 'x-test-user': 'user-1' },
    });
    expect(resp.statusCode).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('grocery_items');
    const body = JSON.parse(resp.body);
    expect(body.items[0].estimated_price).toBe(45.5);
    await app.close();
  });

  it('toggle grocery item filters the UPDATE by user_id too (defense in depth)', async () => {
    const { app, supabase } = buildApp({
      grocery_items: { data: { is_purchased: false } },
    });
    await app.register(plannerRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'PATCH',
      url: '/v1/planner/grocery/items/item-1/toggle',
      headers: { 'x-test-user': 'user-1' },
    });
    expect(resp.statusCode).toBe(200);

    // Second call to grocery_items is the UPDATE — verify it repeats the ownership filter.
    const groceryCalls = supabase.from.mock.results.filter((r, i) => supabase.from.mock.calls[i]![0] === 'grocery_items');
    const updateChain = groceryCalls[1]!.value;
    expect(updateChain.update).toHaveBeenCalledWith({ is_purchased: true });
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    await app.close();
  });
});

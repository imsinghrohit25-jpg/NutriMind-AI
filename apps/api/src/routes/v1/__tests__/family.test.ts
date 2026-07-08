// Route-level tests for family.ts — this route file previously hardcoded `/api/v1/family/*`
// paths (never resolving to anything, since routes/v1/index.ts registers with prefix '/v1'),
// read `(request as any).user` without an auth guard (a null user would throw, not 401), and its
// dashboard endpoint queried a non-existent `food_logs` table with an invalid
// `.eq('logged_at::date', ...)` raw-SQL-cast filter. See ADR-0022.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import familyRoutes from '../family.js';

function makeChainable(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.order = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(resolved));
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolved).then(onFulfilled);
  return chain;
}

function buildMockSupabase(perTable: Record<string, { data?: unknown; error?: unknown }> = {}) {
  return { from: vi.fn((table: string) => makeChainable(perTable[table] ?? { data: [] })) };
}

function buildApp(supabase: unknown): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate('supabase', supabase as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers['x-test-user'];
    if (typeof header === 'string') {
      request.user = { id: header, role: 'authenticated' };
    }
  });
  return app;
}

describe('family routes', () => {
  describe('auth required', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      app = buildApp(buildMockSupabase());
      await app.register(familyRoutes, { prefix: '/v1' });
      await app.ready();
    });
    afterAll(async () => app.close());

    it('rejects POST /v1/family/groups with 401 when unauthenticated', async () => {
      const resp = await app.inject({ method: 'POST', url: '/v1/family/groups', payload: { name: 'Test' } });
      expect(resp.statusCode).toBe(401);
    });

    it('rejects GET /v1/family/groups with 401 when unauthenticated', async () => {
      const resp = await app.inject({ method: 'GET', url: '/v1/family/groups' });
      expect(resp.statusCode).toBe(401);
    });
  });

  describe('POST /v1/family/groups', () => {
    it('creates a group and adds the owner as a member (real /v1 path, not /api/v1)', async () => {
      const supabase = buildMockSupabase({
        family_groups: { data: { id: 'g1', owner_id: 'user-1', name: 'Test Family', created_at: '2026-01-01' } },
      });
      const app = buildApp(supabase);
      await app.register(familyRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'POST',
        url: '/v1/family/groups',
        headers: { 'x-test-user': 'user-1' },
        payload: { name: 'Test Family' },
      });
      expect(resp.statusCode).toBe(201);
      expect(supabase.from).toHaveBeenCalledWith('family_groups');
      expect(supabase.from).toHaveBeenCalledWith('family_members');
      await app.close();
    });
  });

  describe('GET /v1/family/groups/:groupId/dashboard', () => {
    it('aggregates meal_logs (not the non-existent food_logs) with correct nutrition columns', async () => {
      const supabase = buildMockSupabase({
        family_members: { data: [{ user_id: 'user-1', role: 'owner' }, { user_id: 'user-2', role: 'member' }] },
        meal_logs: {
          data: [
            { user_id: 'user-1', energy_kcal: 500, protein_g: 20, fat_total_g: 10, carbohydrates_g: 60 },
            { user_id: 'user-2', energy_kcal: 300, protein_g: 15, fat_total_g: 5, carbohydrates_g: 40 },
          ],
        },
      });
      const app = buildApp(supabase);
      await app.register(familyRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'GET',
        url: '/v1/family/groups/g1/dashboard?date=2026-01-15',
        headers: { 'x-test-user': 'user-1' },
      });

      expect(resp.statusCode).toBe(200);
      expect(supabase.from).toHaveBeenCalledWith('meal_logs');
      expect(supabase.from).not.toHaveBeenCalledWith('food_logs');

      const body = JSON.parse(resp.body);
      const member1 = body.members.find((m: { userId: string }) => m.userId === 'user-1');
      expect(member1.calories).toBe(500);
      expect(member1.protein).toBe(20);
      expect(member1.carbs).toBe(60);
      expect(member1.fat).toBe(10);
      await app.close();
    });

    it('uses a gte/lt date-range filter, never an invalid logged_at::date cast', async () => {
      const supabase = buildMockSupabase({
        family_members: { data: [{ user_id: 'user-1', role: 'owner' }] },
      });
      const app = buildApp(supabase);
      await app.register(familyRoutes, { prefix: '/v1' });
      await app.ready();

      await app.inject({
        method: 'GET',
        url: '/v1/family/groups/g1/dashboard?date=2026-01-15',
        headers: { 'x-test-user': 'user-1' },
      });

      const mealLogsChain = supabase.from.mock.results.find(
        (r, i) => supabase.from.mock.calls[i]![0] === 'meal_logs',
      )!.value;
      expect(mealLogsChain.gte).toHaveBeenCalledWith('logged_at', '2026-01-15T00:00:00.000Z');
      expect(mealLogsChain.lt).toHaveBeenCalledWith('logged_at', '2026-01-16T00:00:00.000Z');
      expect(mealLogsChain.eq).not.toHaveBeenCalledWith('logged_at::date', expect.anything());
      await app.close();
    });

    it('returns 403 when the caller is not a member of the group', async () => {
      const supabase = buildMockSupabase({
        family_members: { data: [{ user_id: 'someone-else', role: 'owner' }] },
      });
      const app = buildApp(supabase);
      await app.register(familyRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'GET',
        url: '/v1/family/groups/g1/dashboard',
        headers: { 'x-test-user': 'user-1' },
      });
      expect(resp.statusCode).toBe(403);
      await app.close();
    });
  });

  describe('shared shopping list', () => {
    it('creates a list and an item end-to-end', async () => {
      const supabase = buildMockSupabase({
        family_shopping_lists: { data: { id: 'list-1', group_id: 'g1', title: 'Groceries' } },
        family_shopping_items: { data: { id: 'item-1', name: 'Milk' } },
      });
      const app = buildApp(supabase);
      await app.register(familyRoutes, { prefix: '/v1' });
      await app.ready();

      const createResp = await app.inject({
        method: 'POST',
        url: '/v1/family/groups/g1/shopping',
        headers: { 'x-test-user': 'user-1' },
        payload: { title: 'Groceries' },
      });
      expect(createResp.statusCode).toBe(201);

      const itemResp = await app.inject({
        method: 'POST',
        url: '/v1/family/shopping/list-1/items',
        headers: { 'x-test-user': 'user-1' },
        payload: { name: 'Milk' },
      });
      expect(itemResp.statusCode).toBe(201);
      await app.close();
    });
  });
});

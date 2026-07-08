// Route-level tests for the Phase 8 DSR endpoints. This route previously wasn't reachable at
// all (never registered — see ADR-0021), used a `user_profiles`/`scan_history` table naming
// that doesn't exist, and read a `req.userId` property `plugins/auth.ts` never sets. These tests
// exercise the fixed route end-to-end (via `app.inject`) against a mocked Supabase client, using
// the ACTUAL table/column names (`users_profiles`.`id`, `household_members`.`owner_id`, etc.).

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import dataRightsRoutes from '../data-rights.js';

interface ChainResult {
  data?: unknown;
  error?: unknown;
  count?: number;
}

function makeChainable(result: ChainResult) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.update = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.maybeSingle = vi.fn(() => Promise.resolve(resolved));
  chain.single = vi.fn(() => Promise.resolve(resolved));
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolved).then(onFulfilled);
  return chain;
}

function buildMockSupabase(perTable: Record<string, ChainResult> = {}) {
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  return {
    from: vi.fn((table: string) => makeChainable(perTable[table] ?? { data: [], count: 0 })),
    auth: { admin: { deleteUser } },
  };
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

describe('DSR routes (data-rights.ts)', () => {
  describe('GET /v1/data-rights/rights', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      app = buildApp(buildMockSupabase());
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();
    });
    afterAll(async () => app.close());

    it('returns a regime and the applicable rights list without auth', async () => {
      const resp = await app.inject({ method: 'GET', url: '/v1/data-rights/rights' });
      expect(resp.statusCode).toBe(200);
      const body = JSON.parse(resp.body);
      expect(body.data.regime).toBe('GENERIC'); // no country plugin registered in this test app
      expect(body.data.rights.map((r: { id: string }) => r.id)).toContain('erasure');
    });
  });

  describe('auth required', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      app = buildApp(buildMockSupabase());
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();
    });
    afterAll(async () => app.close());

    it('rejects export with 401 when unauthenticated', async () => {
      const resp = await app.inject({ method: 'POST', url: '/v1/data-rights/export' });
      expect(resp.statusCode).toBe(401);
    });
  });

  describe('POST /v1/data-rights/export', () => {
    it('queries every user-data table by its correct owning column', async () => {
      const supabase = buildMockSupabase({
        users_profiles: { data: [{ id: 'user-1', display_name: 'Test' }] },
      });
      const app = buildApp(supabase);
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'POST',
        url: '/v1/data-rights/export',
        headers: { 'x-test-user': 'user-1' },
      });
      expect(resp.statusCode).toBe(200);

      // The real table name (not the pre-Phase-8 'user_profiles' typo)
      expect(supabase.from).toHaveBeenCalledWith('users_profiles');
      expect(supabase.from).toHaveBeenCalledWith('household_members');
      expect(supabase.from).toHaveBeenCalledWith('scans'); // not 'scan_history'
      expect(supabase.from).not.toHaveBeenCalledWith('user_profiles');
      expect(supabase.from).not.toHaveBeenCalledWith('scan_history');

      // The export endpoint sends a raw JSON payload (not the ok()/err() API envelope) since it
      // sets Content-Disposition: attachment for a file download.
      const body = JSON.parse(resp.body);
      expect(body.data.users_profiles).toEqual([{ id: 'user-1', display_name: 'Test' }]);
      await app.close();
    });
  });

  describe('POST /v1/data-rights/delete', () => {
    it('deletes from every table by its correct owning column and verifies zero rows remain', async () => {
      const supabase = buildMockSupabase(); // every table resolves { data: [], count: 0 } by default
      const app = buildApp(supabase);
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'POST',
        url: '/v1/data-rights/delete',
        headers: { 'x-test-user': 'user-1' },
      });

      expect(resp.statusCode).toBe(200);
      const body = JSON.parse(resp.body);
      expect(body.data.deleted).toBe(true);
      expect(body.data.remainingRows).toBe(0);
      expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-1');
      await app.close();
    });

    it('reports failure when rows remain after deletion (verification gate)', async () => {
      const supabase = buildMockSupabase({ users_profiles: { data: [], count: 1 } });
      const app = buildApp(supabase);
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'POST',
        url: '/v1/data-rights/delete',
        headers: { 'x-test-user': 'user-1' },
      });

      expect(resp.statusCode).toBe(500);
      const body = JSON.parse(resp.body);
      expect(body.error.code).toBe('DELETION_UNVERIFIED');
      await app.close();
    });
  });

  describe('PATCH /v1/data-rights/rectify', () => {
    it('updates users_profiles by id (not a non-existent user_id column)', async () => {
      const supabase = buildMockSupabase({
        users_profiles: { data: { id: 'user-1', display_name: 'Corrected Name' } },
      });
      const app = buildApp(supabase);
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'PATCH',
        url: '/v1/data-rights/rectify',
        headers: { 'x-test-user': 'user-1' },
        payload: { display_name: 'Corrected Name' },
      });

      expect(resp.statusCode).toBe(200);
      const chainable = supabase.from.mock.results.find((r) => true)!.value;
      expect(chainable.update).toHaveBeenCalledWith({ display_name: 'Corrected Name' });
      expect(chainable.eq).toHaveBeenCalledWith('id', 'user-1');
      await app.close();
    });

    it('rejects an empty rectification body', async () => {
      const app = buildApp(buildMockSupabase());
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'PATCH',
        url: '/v1/data-rights/rectify',
        headers: { 'x-test-user': 'user-1' },
        payload: {},
      });
      expect(resp.statusCode).toBe(400);
      await app.close();
    });

    it('rejects unknown fields', async () => {
      const app = buildApp(buildMockSupabase());
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'PATCH',
        url: '/v1/data-rights/rectify',
        headers: { 'x-test-user': 'user-1' },
        payload: { tdee_kcal: 9999 }, // engine-computed field, not user-correctable
      });
      expect(resp.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('processing restriction', () => {
    it('records a restriction request and reports it back with the enforcement-gap note', async () => {
      const app = buildApp(buildMockSupabase());
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'POST',
        url: '/v1/data-rights/restrict',
        headers: { 'x-test-user': 'user-1' },
        payload: { reason: 'disputing accuracy' },
      });
      expect(resp.statusCode).toBe(200);
      const body = JSON.parse(resp.body);
      expect(body.data.restricted).toBe(true);
      expect(body.data.note).toMatch(/no automated processing pipeline/);
      await app.close();
    });

    it('returns null status when no restriction has been requested', async () => {
      const supabase = buildMockSupabase({ processing_restrictions: { data: null } });
      const app = buildApp(supabase);
      await app.register(dataRightsRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'GET',
        url: '/v1/data-rights/restrict',
        headers: { 'x-test-user': 'user-1' },
      });
      expect(resp.statusCode).toBe(200);
      const body = JSON.parse(resp.body);
      expect(body.data.status).toBeNull();
      await app.close();
    });
  });
});

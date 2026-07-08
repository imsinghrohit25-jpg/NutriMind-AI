import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import privacyRoutes from '../privacy.js';

function makeChainable(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.order = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  return chain;
}

function buildMockSupabase(rows: unknown[] = []) {
  return { from: vi.fn(() => makeChainable(rows)) };
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

describe('privacy routes', () => {
  describe('GET /v1/privacy/regime', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      app = buildApp(buildMockSupabase());
      await app.register(privacyRoutes, { prefix: '/v1' });
      await app.ready();
    });
    afterAll(async () => app.close());

    it('resolves GENERIC without a country plugin and returns requirements', async () => {
      const resp = await app.inject({ method: 'GET', url: '/v1/privacy/regime' });
      expect(resp.statusCode).toBe(200);
      const body = JSON.parse(resp.body);
      expect(body.data.regime).toBe('GENERIC');
      expect(body.data.requirements.length).toBeGreaterThan(0);
    });
  });

  describe('auth required', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      app = buildApp(buildMockSupabase());
      await app.register(privacyRoutes, { prefix: '/v1' });
      await app.ready();
    });
    afterAll(async () => app.close());

    it('rejects GET consent with 401 when unauthenticated', async () => {
      const resp = await app.inject({ method: 'GET', url: '/v1/privacy/consent' });
      expect(resp.statusCode).toBe(401);
    });

    it('rejects POST consent with 401 when unauthenticated', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/v1/privacy/consent',
        payload: { consentType: 'marketing', version: 'v1' },
      });
      expect(resp.statusCode).toBe(401);
    });
  });

  describe('POST /v1/privacy/consent', () => {
    let app: FastifyInstance;
    let supabase: ReturnType<typeof buildMockSupabase>;
    beforeAll(async () => {
      supabase = buildMockSupabase();
      app = buildApp(supabase);
      await app.register(privacyRoutes, { prefix: '/v1' });
      await app.ready();
    });
    afterAll(async () => app.close());

    it('records a consent grant', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/v1/privacy/consent',
        headers: { 'x-test-user': 'user-1' },
        payload: { consentType: 'marketing', version: 'v1' },
      });
      expect(resp.statusCode).toBe(200);
      expect(supabase.from).toHaveBeenCalledWith('user_consents');
    });

    it('rejects an unrecognised consentType', async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/v1/privacy/consent',
        headers: { 'x-test-user': 'user-1' },
        payload: { consentType: 'not_a_real_type', version: 'v1' },
      });
      expect(resp.statusCode).toBe(400);
    });
  });

  describe('GET /v1/privacy/consent', () => {
    it('returns the resolved status per consent type', async () => {
      const rows = [
        { consent_type: 'privacy', version: 'v1', granted: true, accepted_at: '2026-01-01T00:00:00Z' },
        { consent_type: 'marketing', version: 'v1', granted: false, accepted_at: '2026-02-01T00:00:00Z' },
      ];
      const app = buildApp(buildMockSupabase(rows));
      await app.register(privacyRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'GET',
        url: '/v1/privacy/consent',
        headers: { 'x-test-user': 'user-1' },
      });
      expect(resp.statusCode).toBe(200);
      const body = JSON.parse(resp.body);
      expect(body.data.status).toHaveLength(2);
      await app.close();
    });
  });

  describe('POST /v1/privacy/consent/withdraw', () => {
    it('records a withdrawal event', async () => {
      const supabase = buildMockSupabase();
      const app = buildApp(supabase);
      await app.register(privacyRoutes, { prefix: '/v1' });
      await app.ready();

      const resp = await app.inject({
        method: 'POST',
        url: '/v1/privacy/consent/withdraw',
        headers: { 'x-test-user': 'user-1' },
        payload: { consentType: 'marketing', version: 'v1' },
      });
      expect(resp.statusCode).toBe(200);
      const body = JSON.parse(resp.body);
      expect(body.data.withdrawn).toBe(true);
      await app.close();
    });
  });
});

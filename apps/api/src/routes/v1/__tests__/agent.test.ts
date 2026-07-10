import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import agentRoutes, { _resetAgentFlagCache } from '../agent.js';

function makeSupabase(flagEnabled: boolean | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'feature_flags') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: () => Promise.resolve({
                  data: flagEnabled === null ? null : { enabled: flagEnabled }, error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'users_profiles') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { display_name: 'Asha', allergens: [] }, error: null }) }) }) };
      }
      if (table === 'user_memory_facts') {
        return { select: () => ({ eq: () => ({ gte: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe('POST /v1/agent/chat', () => {
  let app: FastifyInstance;
  let supabase: ReturnType<typeof makeSupabase>;

  beforeEach(async () => {
    _resetAgentFlagCache();
    app = Fastify({ logger: false });
    supabase = makeSupabase(true);
    app.decorate('supabase', supabase as never);
    app.decorate('sql', vi.fn(() => Promise.resolve([])) as never);
    app.decorate('gateway', null as never);
    app.decorate('offClient', { searchByName: vi.fn(async () => []) } as never);
    app.decorate('usdaClient', null as never);
    app.decorate('ifct', { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
    app.decorate('cofid', { isAvailable: () => false } as never);
    app.decorate('productCache', undefined as never);
    app.decorateRequest('user', null);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      const header = request.headers['x-test-user'];
      if (typeof header === 'string') request.user = { id: header, role: 'authenticated' };
    });
    await app.register(agentRoutes, { prefix: '/v1' });
    await app.ready();
  });

  it('requires auth', async () => {
    const resp = await app.inject({ method: 'POST', url: '/v1/agent/chat', payload: { message: 'hi' } });
    expect(resp.statusCode).toBe(401);
  });

  it('fails closed (503) when the feature flag is disabled', async () => {
    supabase = makeSupabase(false);
    app2SetSupabase(app, supabase);
    const resp = await app.inject({
      method: 'POST', url: '/v1/agent/chat', headers: { 'x-test-user': 'user-1' }, payload: { message: 'hi' },
    });
    expect(resp.statusCode).toBe(503);
    expect(JSON.parse(resp.body).error.code).toBe('FEATURE_DISABLED');
  });

  it('fails closed (503) when the flag row does not exist at all', async () => {
    supabase = makeSupabase(null);
    app2SetSupabase(app, supabase);
    const resp = await app.inject({
      method: 'POST', url: '/v1/agent/chat', headers: { 'x-test-user': 'user-1' }, payload: { message: 'hi' },
    });
    expect(resp.statusCode).toBe(503);
  });

  it('validates the request body when the flag is enabled', async () => {
    const resp = await app.inject({
      method: 'POST', url: '/v1/agent/chat', headers: { 'x-test-user': 'user-1' }, payload: { message: '' },
    });
    expect(resp.statusCode).toBe(400);
  });

  it('streams real SSE lifecycle events ending in "done", with a properly-formed response', async () => {
    const resp = await app.inject({
      method: 'POST', url: '/v1/agent/chat', headers: { 'x-test-user': 'user-1' }, payload: { message: 'kya khana chahiye' },
    });

    expect(resp.headers['content-type']).toBe('text/event-stream');
    expect(resp.body).toContain('event: agent_started');
    expect(resp.body).toContain('event: done');
  });
});

// Fastify decorators are set once at registration; this helper swaps the underlying object's
// contents in place so a single `app` instance can be reused across tests with different flag
// states, since `supabase` is captured by reference at decorate() time.
function app2SetSupabase(app: FastifyInstance, next: ReturnType<typeof makeSupabase>): void {
  Object.assign(app.supabase as object, next);
}

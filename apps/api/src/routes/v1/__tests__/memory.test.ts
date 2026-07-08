import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import memoryRoutes from '../memory.js';

function makeChainable(result: { data?: unknown; error?: unknown } = {}) {
  const resolved = { data: null, error: null, ...result };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.order = vi.fn(() => Promise.resolve(resolved));
  chain.delete = vi.fn(self);
  chain.insert = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

describe('memory routes', () => {
  let app: FastifyInstance;
  let supabase: { from: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    app = Fastify({ logger: false });
    supabase = { from: vi.fn(() => makeChainable({ data: [] })) };
    app.decorate('supabase', supabase as never);
    app.decorateRequest('user', null);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      const header = request.headers['x-test-user'];
      if (typeof header === 'string') request.user = { id: header, role: 'authenticated' };
    });
    await app.register(memoryRoutes, { prefix: '/v1' });
    await app.ready();
  });

  it('GET /v1/memory requires auth', async () => {
    const resp = await app.inject({ method: 'GET', url: '/v1/memory' });
    expect(resp.statusCode).toBe(401);
  });

  it('GET /v1/memory returns the caller’s own facts', async () => {
    const resp = await app.inject({ method: 'GET', url: '/v1/memory', headers: { 'x-test-user': 'user-1' } });
    expect(resp.statusCode).toBe(200);
    expect(JSON.parse(resp.body).data.facts).toEqual([]);
  });

  it('DELETE /v1/memory/:factId deletes scoped to the caller', async () => {
    const chain = makeChainable();
    supabase.from.mockReturnValue(chain);
    const resp = await app.inject({
      method: 'DELETE', url: '/v1/memory/fact-1', headers: { 'x-test-user': 'user-1' },
    });
    expect(resp.statusCode).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith('fact_id', 'fact-1');
  });

  it('POST /v1/memory/feedback validates the body', async () => {
    const resp = await app.inject({
      method: 'POST', url: '/v1/memory/feedback', headers: { 'x-test-user': 'user-1' },
      payload: { action: 'not-a-real-action' },
    });
    expect(resp.statusCode).toBe(400);
  });

  it('POST /v1/memory/feedback records real feedback on success', async () => {
    const resp = await app.inject({
      method: 'POST', url: '/v1/memory/feedback', headers: { 'x-test-user': 'user-1' },
      payload: { recommendationId: '11111111-1111-1111-1111-111111111111', action: 'accepted', category: 'recipe' },
    });
    expect(resp.statusCode).toBe(201);
    expect(supabase.from).toHaveBeenCalledWith('recommendation_feedback');
  });

  it('POST /v1/memory/feedback returns 500 on a real DB error, not a silent success', async () => {
    supabase.from.mockImplementation((table: string) =>
      table === 'recommendation_feedback' ? makeChainable({ error: { message: 'db down' } }) : makeChainable({}),
    );
    const resp = await app.inject({
      method: 'POST', url: '/v1/memory/feedback', headers: { 'x-test-user': 'user-1' },
      payload: { recommendationId: '11111111-1111-1111-1111-111111111111', action: 'rejected' },
    });
    expect(resp.statusCode).toBe(500);
  });
});

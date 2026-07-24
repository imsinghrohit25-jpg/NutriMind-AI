import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import diseaseRoutes from '../disease.js';

async function buildApp(opts: { conditions: string[] | null; authenticated?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('supabase', {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: opts.conditions === null ? null : { conditions: opts.conditions }, error: null }),
        }),
      }),
    })),
  } as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    if (opts.authenticated !== false) {
      request.user = { id: 'user-1', role: 'authenticated' };
    }
  });
  // Match the production error handler's contract for requireAuth's thrown 401.
  app.setErrorHandler((error, _req, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    reply.status(statusCode).send({ ok: false });
  });
  await app.register(diseaseRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

describe('GET /v1/disease/guidance', () => {
  it('401 when unauthenticated', async () => {
    const app = await buildApp({ conditions: [], authenticated: false });
    const resp = await app.inject({ method: 'GET', url: '/v1/disease/guidance' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('returns cited guidance for exactly the user\'s stored conditions', async () => {
    const app = await buildApp({ conditions: ['diabetes', 'thyroid'] });
    const resp = await app.inject({ method: 'GET', url: '/v1/disease/guidance' });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.guidance.map((g: { condition: string }) => g.condition)).toEqual(['diabetes', 'thyroid']);
    expect(body.data.guidance[0].safeFoods.length).toBeGreaterThan(0);
    expect(body.data.guidance[0].avoidFoods.length).toBeGreaterThan(0);
    // citations resolved for exactly the referenced ids
    const citedIds = new Set(body.data.guidance.flatMap((g: { citationIds: string[] }) => g.citationIds));
    expect(body.data.citations.map((c: { id: string }) => c.id).sort()).toEqual([...citedIds].sort());
    expect(body.data.disclaimer).toContain('not medical advice');
    await app.close();
  });

  it('empty conditions → empty guidance, no error', async () => {
    const app = await buildApp({ conditions: [] });
    const resp = await app.inject({ method: 'GET', url: '/v1/disease/guidance' });
    const body = JSON.parse(resp.body);
    expect(body.data.guidance).toEqual([]);
    await app.close();
  });

  it('?all=1 returns the full 10-condition catalogue regardless of profile', async () => {
    const app = await buildApp({ conditions: [] });
    const resp = await app.inject({ method: 'GET', url: '/v1/disease/guidance?all=1' });
    const body = JSON.parse(resp.body);
    expect(body.data.guidance).toHaveLength(11); // 10 chip-based conditions + lactation (reproductive_status-only)
    await app.close();
  });

  it('unknown stored slugs (e.g. "other") are skipped, known ones still returned', async () => {
    const app = await buildApp({ conditions: ['other', 'pcos'] });
    const resp = await app.inject({ method: 'GET', url: '/v1/disease/guidance' });
    const body = JSON.parse(resp.body);
    expect(body.data.guidance).toHaveLength(1);
    expect(body.data.guidance[0].condition).toBe('pcos');
    await app.close();
  });
});

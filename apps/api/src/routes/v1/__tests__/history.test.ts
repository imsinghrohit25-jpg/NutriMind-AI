import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import historyRoutes from '../history.js';
import { upsertScanHistoryEmbedding } from '../../../memory/semantic-search.js';

interface Opts {
  authenticated?: boolean;
  hasGateway?: boolean;
  rpcData?: Array<Record<string, unknown>>;
}

async function buildApp(opts: Opts): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('supabase', {
    rpc: vi.fn(() => Promise.resolve({ data: opts.rpcData ?? [], error: null })),
  } as never);
  app.decorate('gateway', (opts.hasGateway === false
    ? null
    : { embed: vi.fn(() => Promise.resolve({ embeddings: [[0.1, 0.2, 0.3]] })) }) as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    if (opts.authenticated !== false) request.user = { id: 'user-1', role: 'authenticated' };
  });
  app.setErrorHandler((error, _req, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    reply.status(statusCode).send({ ok: false });
  });
  await app.register(historyRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

describe('GET /v1/history/search', () => {
  const rows = [
    { scan_id: 'user-1:p1', metadata: { product_name: 'Salty chips', category: 'snacks' }, health_score: 32, band: 'poor', scanned_at: '2026-07-24T10:00:00Z', similarity: 0.88 },
  ];

  it('401 when unauthenticated', async () => {
    const app = await buildApp({ authenticated: false });
    const resp = await app.inject({ method: 'GET', url: '/v1/history/search?q=snacks' });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('400 when q is missing', async () => {
    const app = await buildApp({});
    const resp = await app.inject({ method: 'GET', url: '/v1/history/search' });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('returns semantic matches mapped to the screen shape', async () => {
    const app = await buildApp({ rpcData: rows });
    const resp = await app.inject({ method: 'GET', url: '/v1/history/search?q=high%20sodium%20snacks' });
    expect(resp.statusCode).toBe(200);
    const data = JSON.parse(resp.body).data;
    expect(data.query).toBe('high sodium snacks');
    expect(data.results).toHaveLength(1);
    expect(data.results[0].productName).toBe('Salty chips');
    expect(data.results[0].healthScore).toBe(32);
    expect(data.results[0].band).toBe('poor');
    expect(data.results[0].similarity).toBe(0.88);
    expect(data.results[0].category).toBe('snacks');
    await app.close();
  });

  it('honest empty result when no embeddings gateway is configured', async () => {
    const app = await buildApp({ hasGateway: false });
    const resp = await app.inject({ method: 'GET', url: '/v1/history/search?q=snacks' });
    expect(resp.statusCode).toBe(200);
    expect(JSON.parse(resp.body).data.results).toEqual([]);
    await app.close();
  });
});

describe('upsertScanHistoryEmbedding', () => {
  it('embeds a descriptive text and upserts one row deduped by user:product', async () => {
    let captured: { row: Record<string, unknown>; opts: Record<string, unknown> } | undefined;
    const supabase = {
      from: vi.fn(() => ({
        upsert: (row: Record<string, unknown>, o: Record<string, unknown>) => {
          captured = { row, opts: o };
          return Promise.resolve({ error: null });
        },
      })),
    } as never;
    const gateway = { embed: vi.fn(() => Promise.resolve({ embeddings: [[0.1, 0.2]] })) } as never;

    await upsertScanHistoryEmbedding(supabase, gateway, {
      userId: 'u1',
      productId: 'p1',
      productName: 'Salty chips',
      category: 'snacks',
      healthScore: 32.4,
      band: 'poor',
    });

    expect(captured!.row.scan_id).toBe('u1:p1'); // deterministic dedup key
    expect(captured!.opts.onConflict).toBe('scan_id');
    expect((captured!.row.metadata as { product_name: string }).product_name).toBe('Salty chips');
    expect(captured!.row.band).toBe('poor');
    expect(String(captured!.row.text)).toContain('Salty chips');
    expect(String(captured!.row.text)).toContain('poor');
  });
});

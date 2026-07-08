import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import packRoutes from '../packs.js';

function buildApp(opts: { ifctAvailable?: boolean } = {}) {
  const ifctAvailable = opts.ifctAvailable ?? false;
  const app = Fastify({ logger: false });
  app.decorate('ifct', {
    isAvailable: () => ifctAvailable,
    count: ifctAvailable ? 1 : 0,
    getAll: () => (ifctAvailable ? [{ foodCode: 'A001', foodNameEn: 'Masoor Dal' }] : []),
    toCanonicalProduct: vi.fn().mockReturnValue({ nutrition: { energyKcal: 343 } }),
  } as never);
  app.decorate('cofid', {
    isAvailable: () => false,
    size: 0,
    getAll: () => [],
    toCanonicalProduct: vi.fn(),
  } as never);
  return app;
}

describe('pack routes', () => {
  it('GET /v1/packs lists the manifest with honest availability (no dataset installed here)', async () => {
    const app = buildApp();
    await app.register(packRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/packs' });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.packs.map((p: { packId: string }) => p.packId).sort()).toEqual(['cofid_gb_2021', 'ifct_in_2017']);
    expect(body.data.packs.every((p: { available: boolean }) => p.available === false)).toBe(true);
    await app.close();
  });

  it('reports real availability/item counts when a dataset is loaded', async () => {
    const app = buildApp({ ifctAvailable: true });
    await app.register(packRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/packs' });
    const body = JSON.parse(resp.body);
    const ifctPack = body.data.packs.find((p: { packId: string }) => p.packId === 'ifct_in_2017');
    expect(ifctPack.available).toBe(true);
    expect(ifctPack.itemCount).toBe(1);
    await app.close();
  });

  it('GET /v1/packs/:packId/sync returns 404 for an unknown pack', async () => {
    const app = buildApp();
    await app.register(packRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/packs/nonexistent/sync' });
    expect(resp.statusCode).toBe(404);
    await app.close();
  });

  it('sync returns an empty, up-to-date result when the dataset is unavailable — never fabricates data', async () => {
    const app = buildApp({ ifctAvailable: false });
    await app.register(packRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'GET', url: '/v1/packs/ifct_in_2017/sync' });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.upToDate).toBe(true);
    expect(body.data.items).toHaveLength(0);
    await app.close();
  });

  it('sync returns the full snapshot on first sync, then an empty diff on a matching version', async () => {
    const app = buildApp({ ifctAvailable: true });
    await app.register(packRoutes, { prefix: '/v1' });
    await app.ready();

    const first = await app.inject({ method: 'GET', url: '/v1/packs/ifct_in_2017/sync' });
    const firstBody = JSON.parse(first.body);
    expect(firstBody.data.upToDate).toBe(false);
    expect(firstBody.data.items).toHaveLength(1);

    const second = await app.inject({ method: 'GET', url: `/v1/packs/ifct_in_2017/sync?version=${firstBody.data.datasetVersion}` });
    const secondBody = JSON.parse(second.body);
    expect(secondBody.data.upToDate).toBe(true);
    expect(secondBody.data.items).toHaveLength(0);
    await app.close();
  });
});

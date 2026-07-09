import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import readyRoutes from '../ready.js';

async function buildApp(sql: unknown) {
  const app = Fastify({ logger: false });
  app.decorate('sql', sql as never);
  await app.register(readyRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

describe('GET /v1/ready', () => {
  it('returns 200 ready when the database ping succeeds', async () => {
    const sql = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const app = await buildApp(sql);

    const response = await app.inject({ method: 'GET', url: '/v1/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, data: { status: 'ready' } });
    await app.close();
  });

  it('returns 503 not_ready when the database ping rejects', async () => {
    const sql = vi.fn().mockRejectedValue(new Error('connection refused'));
    const app = await buildApp(sql);

    const response = await app.inject({ method: 'GET', url: '/v1/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json().data.reason).toBe('database_unreachable');
    await app.close();
  });

  it('returns 503 not_ready when the database ping hangs past the timeout', async () => {
    vi.useFakeTimers();
    const sql = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    const app = await buildApp(sql);

    const responsePromise = app.inject({ method: 'GET', url: '/v1/ready' });
    await vi.advanceTimersByTimeAsync(2100);
    const response = await responsePromise;

    expect(response.statusCode).toBe(503);
    await app.close();
    vi.useRealTimers();
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import healthRoutes from '../routes/v1/health.js';

describe('GET /v1/health', () => {
  const app = Fastify({ logger: false });

  beforeAll(async () => {
    await app.register(healthRoutes, { prefix: '/v1' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with healthy status', async () => {
    const resp = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body) as {
      ok: boolean;
      data: { status: string; version: string; uptime: number };
    };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('healthy');
    expect(body.data.version).toBe('0.1.0');
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
  });
});

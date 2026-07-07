import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyRequest } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

describe('Rate limiting', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    await app.register(fastifyRateLimit, {
      global: true,
      max: 3,
      timeWindow: 60_000,
      keyGenerator: (req: FastifyRequest) => req.ip ?? 'test',
    });

    app.get('/test', async () => ({ ok: true, data: 'pong' }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows requests within limit', async () => {
    for (let i = 0; i < 3; i++) {
      const resp = await app.inject({ method: 'GET', url: '/test' });
      expect(resp.statusCode).toBe(200);
    }
  });

  it('blocks requests exceeding limit with 429', async () => {
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: 'GET', url: '/test' });
    }
    const resp = await app.inject({ method: 'GET', url: '/test' });
    expect(resp.statusCode).toBe(429);
  });

  it('includes rate limit headers on success', async () => {
    const resp = await app.inject({ method: 'GET', url: '/test' });
    expect(resp.statusCode).toBe(200);
    expect(resp.headers['x-ratelimit-limit']).toBeDefined();
    expect(resp.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('includes retry-after header on 429', async () => {
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: 'GET', url: '/test' });
    }
    const resp = await app.inject({ method: 'GET', url: '/test' });
    expect(resp.statusCode).toBe(429);
    expect(resp.headers['retry-after']).toBeDefined();
  });
});

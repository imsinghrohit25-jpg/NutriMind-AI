// Route-level tests for voice.ts — previously hardcoded `/api/v1/voice/parse` (never resolved
// to anything real), read a non-existent `req.userId` (always 401'd), and took a 2-arg
// `(fastify, gateway)` signature `fastify.register()` cannot supply. See ADR-0022.

import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import voiceRoutes from '../voice.js';

function buildApp(gateway: unknown = null) {
  const app = Fastify({ logger: false });
  app.decorate('gateway', gateway as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers['x-test-user'];
    if (typeof header === 'string') request.user = { id: header, role: 'authenticated' };
  });
  return app;
}

describe('voice routes', () => {
  it('registers successfully as a single-arg plugin (the pre-fix 2-arg signature would throw here)', async () => {
    const app = buildApp();
    await expect(app.register(voiceRoutes, { prefix: '/v1' })).resolves.not.toThrow();
    await app.ready();
    await app.close();
  });

  it('resolves at the real /v1/voice/parse path, not /api/v1/voice/parse', async () => {
    const app = buildApp();
    await app.register(voiceRoutes, { prefix: '/v1' });
    await app.ready();
    expect(app.hasRoute({ method: 'POST', url: '/v1/voice/parse' })).toBe(true);
    expect(app.hasRoute({ method: 'POST', url: '/api/v1/voice/parse' })).toBe(false);
    await app.close();
  });

  it('rejects with 401 (clean, not a 500) when unauthenticated', async () => {
    const app = buildApp();
    await app.register(voiceRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({ method: 'POST', url: '/v1/voice/parse', payload: { text: 'I ate a roti' } });
    expect(resp.statusCode).toBe(401);
    await app.close();
  });

  it('rejects an empty text body with 400', async () => {
    const app = buildApp();
    await app.register(voiceRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({
      method: 'POST',
      url: '/v1/voice/parse',
      headers: { 'x-test-user': 'user-1' },
      payload: { text: '' },
    });
    expect(resp.statusCode).toBe(400);
    await app.close();
  });

  it('returns 503 (not a crash) when no LLM gateway is configured', async () => {
    const app = buildApp(null);
    await app.register(voiceRoutes, { prefix: '/v1' });
    await app.ready();
    const resp = await app.inject({
      method: 'POST',
      url: '/v1/voice/parse',
      headers: { 'x-test-user': 'user-1' },
      payload: { text: 'I ate two rotis' },
    });
    expect(resp.statusCode).toBe(503);
    await app.close();
  });

  it('parses an utterance end-to-end and returns nlu + tts when a gateway is configured', async () => {
    const fakeGateway = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({ intent: 'log_meal', foods: [{ name: 'roti', nameRaw: 'roti', quantity: 2 }] }),
      }),
    };
    const app = buildApp(fakeGateway);
    await app.register(voiceRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/voice/parse',
      headers: { 'x-test-user': 'user-1' },
      payload: { text: 'I ate two rotis' },
    });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.nlu.intent).toBe('log_meal');
    expect(body.tts).toBeDefined();
    await app.close();
  });
});

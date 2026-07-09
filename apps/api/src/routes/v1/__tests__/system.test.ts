import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import systemRoutes from '../system.js';

async function buildApp(sql: unknown, gateway: unknown) {
  const app = Fastify({ logger: false });
  app.decorate('sql', sql as never);
  app.decorate('gateway', gateway as never);
  await app.register(systemRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

describe('GET /v1/system/degradation', () => {
  it('reports full when DB is reachable and gateway is unconfigured', async () => {
    const app = await buildApp(vi.fn().mockResolvedValue([]), null);
    const response = await app.inject({ method: 'GET', url: '/v1/system/degradation' });
    expect(response.json().data.level).toBe('full');
    await app.close();
  });

  it('reports ai_degraded when a circuit breaker is OPEN', async () => {
    const gateway = { getCircuitBreakerStates: () => ({ anthropic: 'OPEN', openai: 'CLOSED' }) };
    const app = await buildApp(vi.fn().mockResolvedValue([]), gateway);
    const response = await app.inject({ method: 'GET', url: '/v1/system/degradation' });
    expect(response.json().data.level).toBe('ai_degraded');
    await app.close();
  });

  it('reports reference_only when the database is unreachable', async () => {
    const app = await buildApp(vi.fn().mockRejectedValue(new Error('down')), null);
    const response = await app.inject({ method: 'GET', url: '/v1/system/degradation' });
    expect(response.json().data.level).toBe('reference_only');
    await app.close();
  });
});

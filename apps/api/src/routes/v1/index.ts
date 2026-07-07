import type { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import gatewayRoutes from './gateway.js';

export async function registerV1Routes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes, { prefix: '/v1' });
  await fastify.register(gatewayRoutes, { prefix: '/v1' });
}

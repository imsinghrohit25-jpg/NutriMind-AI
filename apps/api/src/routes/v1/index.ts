import type { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import gatewayRoutes from './gateway.js';
import productRoutes from './products.js';
import resolveRoutes from './resolve.js';
import curationRoutes from './curation.js';
import scanRoutes from './scans.js';

export async function registerV1Routes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes, { prefix: '/v1' });
  await fastify.register(gatewayRoutes, { prefix: '/v1' });
  await fastify.register(productRoutes, { prefix: '/v1' });
  await fastify.register(resolveRoutes, { prefix: '/v1' });
  await fastify.register(curationRoutes, { prefix: '/v1' });
  await fastify.register(scanRoutes, { prefix: '/v1' });
}

import type { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import gatewayRoutes from './gateway.js';
import productRoutes from './products.js';
import resolveRoutes from './resolve.js';
import curationRoutes from './curation.js';
import scanRoutes from './scans.js';
import flagRoutes from './flags.js';
import privacyRoutes from './privacy.js';
import dataRightsRoutes from './data-rights.js';

export async function registerV1Routes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes, { prefix: '/v1' });
  await fastify.register(gatewayRoutes, { prefix: '/v1' });
  await fastify.register(productRoutes, { prefix: '/v1' });
  await fastify.register(resolveRoutes, { prefix: '/v1' });
  await fastify.register(curationRoutes, { prefix: '/v1' });
  await fastify.register(scanRoutes, { prefix: '/v1' });
  await fastify.register(flagRoutes, { prefix: '/v1' });
  // Phase 8 (`global.p8.gdpr_consent_flow`/`dpdp_consent_flow`/`dsr_endpoints`) — data-rights.ts
  // existed since the original build but was never registered here; see ADR-0021.
  await fastify.register(privacyRoutes, { prefix: '/v1' });
  await fastify.register(dataRightsRoutes, { prefix: '/v1' });
}

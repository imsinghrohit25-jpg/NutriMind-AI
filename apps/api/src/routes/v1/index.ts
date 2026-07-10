import type { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import readyRoutes from './ready.js';
import systemRoutes from './system.js';
import gatewayRoutes from './gateway.js';
import productRoutes from './products.js';
import resolveRoutes from './resolve.js';
import curationRoutes from './curation.js';
import scanRoutes from './scans.js';
import flagRoutes from './flags.js';
import privacyRoutes from './privacy.js';
import dataRightsRoutes from './data-rights.js';
import familyRoutes from './family.js';
import restaurantRoutes from './restaurant.js';
import plannerRoutes from './planner.js';
import pantryRoutes from './pantry.js';
import biomarkerRoutes from './biomarker.js';
import healthDataRoutes from './health-data.js';
import voiceRoutes from './voice.js';
import packRoutes from './packs.js';
import onboardingRoutes from './onboarding.js';
import memoryRoutes from './memory.js';
import agentRoutes from './agent.js';

export async function registerV1Routes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes, { prefix: '/v1' });
  await fastify.register(readyRoutes, { prefix: '/v1' });
  await fastify.register(systemRoutes, { prefix: '/v1' });
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
  // Route-registration audit (ADR-0022): family.ts, restaurant.ts, planner.ts, pantry.ts,
  // biomarker.ts, health-data.ts, and voice.ts all existed since the original build with real
  // handler code but were never registered here — completely unreachable. Each also had at
  // least one of: a non-default/multi-arg export signature incompatible with
  // `fastify.register()`, a hardcoded `/api/v1/...` path (this file's `{ prefix: '/v1' }`
  // resolves paths to `/v1/...`, not `/api/v1/...`), a `req.userId` property `auth.ts` never
  // sets, or (restaurant.ts, family.ts) references to non-existent tables/columns. All fixed;
  // see ADR-0022 for the full defect list per file.
  await fastify.register(familyRoutes, { prefix: '/v1' });
  await fastify.register(restaurantRoutes, { prefix: '/v1' });
  await fastify.register(plannerRoutes, { prefix: '/v1' });
  await fastify.register(pantryRoutes, { prefix: '/v1' });
  await fastify.register(biomarkerRoutes, { prefix: '/v1' });
  await fastify.register(healthDataRoutes, { prefix: '/v1' });
  await fastify.register(voiceRoutes, { prefix: '/v1' });
  // Phase 9 (`global.p9.incremental_regional_sync`)
  await fastify.register(packRoutes, { prefix: '/v1' });
  // Phase 10 (`global.p10.country_onboarding_v2`)
  await fastify.register(onboardingRoutes, { prefix: '/v1' });
  // Phase 11 (`global.p11.ai_memory_system`)
  await fastify.register(memoryRoutes, { prefix: '/v1' });
  // Phase 13 (`global.p13.multi_agent_system`)
  await fastify.register(agentRoutes, { prefix: '/v1' });
}

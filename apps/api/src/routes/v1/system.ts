// System status — Phase 12 (§13.5 degradation ladder). Read-only, unauthenticated (matches
// /v1/gateway/status's existing precedent — ops visibility, no user data exposed).
import type { FastifyPluginAsync } from 'fastify';
import { pingDatabase } from './ready.js';
import { computeDegradationLevel } from '../../reliability/degradation.js';

const systemRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/system/degradation', {}, async (_request, _reply) => {
    const dbCheck = await pingDatabase(fastify.sql, 2000);
    const breakerStates = fastify.gateway?.getCircuitBreakerStates() ?? {};
    const aiCircuitOpen = Object.values(breakerStates).some((s) => s === 'OPEN');

    const status = computeDegradationLevel({ dbReachable: dbCheck.ok, aiCircuitOpen });

    return { ok: true, data: status };
  });
};

export default systemRoutes;

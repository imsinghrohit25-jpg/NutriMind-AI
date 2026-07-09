import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LLMRequestSchema } from '@nutrimind/shared';
import { requireAuth } from '../../plugins/auth.js';
import { isKillSwitchActive, AI_KILL_SWITCH_FLAG_KEY } from '../../gateway/cost-governance.js';

const GatewayCompleteBodySchema = LLMRequestSchema.omit({ traceId: true, userId: true });

const gatewayRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/gateway/complete', {
    config: { requiredRole: 'authenticated' as const },
  }, async (request, reply) => {
    requireAuth(request);

    const body = GatewayCompleteBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: body.error.flatten(),
        },
      });
    }

    const router = fastify.gateway;
    if (!router) {
      return reply.status(503).send({
        ok: false,
        error: { code: 'GATEWAY_UNAVAILABLE', message: 'AI gateway not configured' },
      });
    }

    const llmRequest = {
      ...body.data,
      traceId: request.traceId,
      userId: request.user.id,
    };

    const response = await router.complete(llmRequest);
    return { ok: true, data: response, meta: { requestId: request.id as string } };
  });

  fastify.get('/gateway/status', {
    config: {},
  }, async (_request, _reply) => {
    const router = fastify.gateway;
    const states = router?.getCircuitBreakerStates() ?? {};
    const backpressure = router?.getBackpressureStatus() ?? null;
    // Phase 12 (§13.3) — surfaces the same kill-switch flag the ai-cost-budget-check job flips,
    // so an operator (or the per-country cost dashboard) can see it without querying Postgres.
    const killSwitchActive = await isKillSwitchActive(fastify.supabase);
    return {
      ok: true,
      data: {
        circuitBreakers: states,
        backpressure,
        costGovernance: { killSwitchActive, flagKey: AI_KILL_SWITCH_FLAG_KEY },
      },
    };
  });
};

export default gatewayRoutes;

// AI Memory System routes — transparency + feedback. Phase 11 (`global.p11.ai_memory_system`).
// Registered with prefix '/v1' in routes/v1/index.ts — real reachable paths are `/v1/memory/*`.
//
// GET    /v1/memory                — list this user's own active memory facts (transparency UI)
// DELETE /v1/memory/:factId        — per-item delete (also directly allowed by RLS; this route
//                                     exists so mobile doesn't need direct table access)
// POST   /v1/memory/feedback       — recommendation feedback, the adaptive loop's only input

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { getFacts, deleteFact } from '../../memory/facts-service.js';
import { recordEventBestEffort } from '../../memory/events.js';
import { ok, err } from '@nutrimind/shared';

const FeedbackBodySchema = z.object({
  recommendationId: z.string().uuid(),
  action: z.enum(['accepted', 'rejected', 'modified']),
  category: z.string().max(100).default('general'),
  reason: z.string().max(500).optional(),
});

export default async function memoryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/memory', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const facts = await getFacts(fastify.supabase, request.user.id);
    return reply.send(ok({ facts }));
  });

  fastify.delete<{ Params: { factId: string } }>('/memory/:factId', async (request, reply) => {
    requireAuth(request);
    await deleteFact(fastify.supabase, request.user.id, request.params.factId);
    return reply.send(ok({ deleted: true }));
  });

  fastify.post<{ Body: unknown }>('/memory/feedback', async (request, reply) => {
    requireAuth(request);
    const body = FeedbackBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { recommendationId, action, category, reason } = body.data;

    const { error } = await fastify.supabase.from('recommendation_feedback').insert({
      user_id: request.user.id,
      recommendation_id: recommendationId,
      action,
      reason: reason ?? null,
    });
    if (error) return reply.status(500).send(err('FEEDBACK_FAILED', error.message));

    // The adaptive loop's real event trace — feeds affinity fact recomputation (Layer 2).
    if (action === 'accepted') {
      recordEventBestEffort(fastify.supabase, request.user.id, 'recommendation_accepted', { recommendationId, category });
    } else if (action === 'rejected') {
      recordEventBestEffort(fastify.supabase, request.user.id, 'recommendation_rejected', { recommendationId, category, reason });
    }

    return reply.status(201).send(ok({ recorded: true }));
  });
}

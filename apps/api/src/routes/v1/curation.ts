// POST /v1/curation — user submits a product that failed barcode resolution.
// GET  /v1/curation — list pending curation items (service role only).
// Requires auth for submissions; service role for listing.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { ok, err } from '@nutrimind/shared';

const SubmitCurationSchema = z.object({
  barcode: z.string().min(6).max(30).optional(),
  productNameHint: z.string().min(1).max(200).optional(),
  sourceHint: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export default async function curationRoutes(fastify: FastifyInstance): Promise<void> {
  // User-submitted curation entry for an unresolved product
  fastify.post<{ Body: unknown }>('/curation', {
    config: { requiredRole: 'authenticated' },
  }, async (request, reply) => {
    requireAuth(request);
    const body = SubmitCurationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { barcode, productNameHint, sourceHint, notes } = body.data;
    if (!barcode && !productNameHint) {
      return reply.status(400).send(err('VALIDATION_ERROR', 'At least one of barcode or productNameHint is required'));
    }

    const rows = await fastify.sql<{ id: string }[]>`
      INSERT INTO public.curation_queue (barcode, product_name_hint, source_hint, notes, status)
      VALUES (
        ${barcode ?? null},
        ${productNameHint ?? null},
        ${sourceHint ?? null},
        ${notes ?? null},
        'pending'
      )
      RETURNING id
    `;

    return reply.status(201).send(ok({ curationQueueId: rows[0]!.id }));
  });

  // Service-role only: list pending curation entries
  fastify.get('/curation', {
    config: { requiredRole: 'service_role' },
  }, async (_request, reply) => {
    const items = await fastify.sql<{
      id: string;
      barcode: string | null;
      product_name_hint: string | null;
      status: string;
      priority: number;
      created_at: Date;
    }[]>`
      SELECT id, barcode, product_name_hint, status, priority, created_at
      FROM public.curation_queue
      WHERE status = 'pending'
      ORDER BY priority DESC, created_at ASC
      LIMIT 100
    `;
    return reply.send(ok(items));
  });
}

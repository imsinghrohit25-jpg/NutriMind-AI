// POST /v1/resolve — barcode resolution endpoint.
// Runs the full waterfall (cache → OFF → IFCT → USDA → not-found).
// Auth optional: authenticated users get their userId attached to curation queue entries.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveBarcode, resolveByName } from '../../resolution/waterfall.js';
import { enqueueProductEmbedding } from '../../embeddings/product-pipeline.js';
import { getBoss } from '../../jobs/boss.js';
import { recordEventBestEffort } from '../../memory/events.js';
import { ok, err } from '@nutrimind/shared';

const BarcodeBodySchema = z.object({
  barcode: z.string().min(6).max(30).regex(/^[\d\-]+$/, 'barcode must contain only digits'),
});

const NameBodySchema = z.object({
  name: z.string().min(1).max(200),
});

export default async function resolveRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /v1/resolve/barcode
  fastify.post<{ Body: unknown }>('/resolve/barcode', async (request, reply) => {
    const body = BarcodeBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { barcode } = body.data;
    const userId = (request as { user?: { id?: string } }).user?.id;

    const result = await resolveBarcode(
      barcode,
      {
        sql: fastify.sql,
        offClient: fastify.offClient,
        ifct: fastify.ifct,
        usdaClient: fastify.usdaClient,
        edgeCache: fastify.productCache,
      },
      { userId, persistResult: true },
    );

    // Enqueue embedding if we just persisted a new product
    if (result.productId && result.resolvedBy !== 'cache') {
      try {
        const boss = await getBoss();
        await enqueueProductEmbedding(boss, result.productId);
      } catch {
        // Embedding is best-effort; don't fail the request
      }
    }

    if (result.resolvedBy === 'not_found') {
      return reply.status(404).send(
        ok({
          found: false,
          curationQueueId: result.curationQueueId,
          message: 'Product not found. A curation entry has been created.',
        }),
      );
    }

    // Phase 11 (AI Memory System, Layer 1) — best-effort, never blocks the response.
    if (userId) {
      recordEventBestEffort(fastify.supabase, userId, 'barcode_scanned', {
        barcode,
        resolvedBy: result.resolvedBy,
        productId: result.productId,
      });
    }

    return reply.send(
      ok({
        found: true,
        resolvedBy: result.resolvedBy,
        product: result.product,
      }),
    );
  });

  // POST /v1/resolve/name
  fastify.post<{ Body: unknown }>('/resolve/name', async (request, reply) => {
    const body = NameBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(err('VALIDATION_ERROR', body.error.message));
    }
    const { name } = body.data;

    const result = await resolveByName(name, {
      sql: fastify.sql,
      offClient: fastify.offClient,
      ifct: fastify.ifct,
      usdaClient: fastify.usdaClient,
    });

    if (result.resolvedBy === 'not_found') {
      return reply.status(404).send(ok({ found: false, message: 'No matching food found.' }));
    }

    return reply.send(ok({ found: true, resolvedBy: result.resolvedBy, product: result.product }));
  });
}

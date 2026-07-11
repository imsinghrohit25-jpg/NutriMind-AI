// POST /v1/resolve — barcode/name resolution endpoint.
// Runs the country-aware waterfall (resolution/country-waterfall.ts) — when
// `global.p3.unified_food_schema` is OFF (default) this is byte-identical to the plain
// cache → OFF → IFCT → USDA → not-found waterfall (country-waterfall.ts's own two functions
// delegate straight through to the legacy ones when `engineEnabled` is false, so there is
// deliberately no if/else here — always call the country-aware entry point and let it decide).
// When ON, `request.country` (decorated by country/plugin.ts on every request) additionally
// routes GB → CoFID first and IN → IFCT first before falling through to OFF/USDA.
// Auth optional: authenticated users get their userId attached to curation queue entries.

import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { resolveBarcode, resolveByName } from '../../resolution/country-waterfall.js';
import { enqueueProductEmbedding } from '../../embeddings/product-pipeline.js';
import { getBoss } from '../../jobs/boss.js';
import { recordEventBestEffort } from '../../memory/events.js';
import { ok, err } from '@nutrimind/shared';

const FLAG_KEY = 'global.p3.unified_food_schema';
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000;

let _flagEnabled = false;
let _cacheExpiry = 0;

async function isUnifiedFoodSchemaEnabled(supabase: SupabaseClient): Promise<boolean> {
  if (Date.now() < _cacheExpiry) return _flagEnabled;

  try {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', FLAG_KEY)
      .is('country_code', null)
      .maybeSingle();

    _flagEnabled = data?.enabled ?? false;
  } catch {
    _flagEnabled = false; // fail closed: default to the existing, already-live behavior
  }

  _cacheExpiry = Date.now() + FLAG_CACHE_TTL_MS;
  return _flagEnabled;
}

/** Reset the flag cache — for testing only. */
export function _resetUnifiedFoodSchemaFlagCache(): void {
  _flagEnabled = false;
  _cacheExpiry = 0;
}

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
    const engineEnabled = await isUnifiedFoodSchemaEnabled(fastify.supabase);

    const result = await resolveBarcode(
      barcode,
      request.country,
      {
        sql: fastify.sql,
        offClient: fastify.offClient,
        ifct: fastify.ifct,
        usdaClient: fastify.usdaClient,
        cofid: fastify.cofid,
        edgeCache: fastify.productCache,
      },
      { userId, persistResult: true, engineEnabled },
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
    const engineEnabled = await isUnifiedFoodSchemaEnabled(fastify.supabase);

    const result = await resolveByName(name, request.country, {
      sql: fastify.sql,
      offClient: fastify.offClient,
      ifct: fastify.ifct,
      usdaClient: fastify.usdaClient,
      cofid: fastify.cofid,
    }, { engineEnabled });

    if (result.resolvedBy === 'not_found') {
      return reply.status(404).send(ok({ found: false, message: 'No matching food found.' }));
    }

    return reply.send(ok({ found: true, resolvedBy: result.resolvedBy, product: result.product }));
  });
}

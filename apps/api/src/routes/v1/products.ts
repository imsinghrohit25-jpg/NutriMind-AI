// GET /v1/products/:barcode — fetch a product by barcode (cache-first, no waterfall).
// GET /v1/products/id/:id — fetch a product by DB uuid.

import type { FastifyInstance } from 'fastify';
import { getProductFromCache } from '../../datasources/openfoodfacts/cache.js';
import { ok, err } from '@nutrimind/shared';
import type postgres from 'postgres';

type Sql = postgres.Sql;

async function getProductById(sql: Sql, id: string): Promise<Record<string, unknown> | null> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      p.*,
      pn.energy_kcal, pn.protein_g, pn.fat_total_g, pn.carbohydrates_g,
      pn.sugars_g, pn.sugars_added_g, pn.sugars_added_estimated,
      pn.dietary_fiber_g, pn.sodium_mg, pn.nova_group,
      pn.source AS nutrition_source,
      pi.raw_text AS ingredients_raw_text
    FROM public.products p
    LEFT JOIN public.product_nutrition pn ON pn.product_id = p.id
    LEFT JOIN public.product_ingredients pi ON pi.product_id = p.id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export default async function productRoutes(fastify: FastifyInstance): Promise<void> {
  // Cache-only lookup by barcode — does not trigger the waterfall.
  // Use POST /v1/resolve/barcode for the full resolution flow.
  fastify.get<{ Params: { barcode: string } }>('/products/barcode/:barcode', async (request, reply) => {
    const { barcode } = request.params;
    if (!barcode || barcode.length < 6) {
      return reply.status(400).send(err('VALIDATION_ERROR', 'barcode too short'));
    }

    // Use maximum TTL (no expiry) for direct product lookup
    const product = await getProductFromCache(fastify.sql, barcode, 24 * 365);
    if (!product) {
      return reply.status(404).send(err('NOT_FOUND', 'Product not in cache. Use POST /v1/resolve/barcode to fetch and cache.'));
    }
    return reply.send(ok(product));
  });

  // Direct DB lookup by UUID
  fastify.get<{ Params: { id: string } }>('/products/id/:id', async (request, reply) => {
    const { id } = request.params;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(id)) {
      return reply.status(400).send(err('VALIDATION_ERROR', 'invalid UUID'));
    }
    const product = await getProductById(fastify.sql, id);
    if (!product) {
      return reply.status(404).send(err('NOT_FOUND', 'Product not found'));
    }
    return reply.send(ok(product));
  });
}

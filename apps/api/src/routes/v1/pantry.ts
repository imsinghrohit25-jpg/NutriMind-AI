// Pantry Intelligence routes.
// Registered with prefix '/v1' in routes/v1/index.ts — real reachable paths are
// `/v1/pantry/*` (this file previously hardcoded `/api/v1/pantry/*`, which never resolved to
// anything real, and read `request.user` without a null guard — an unauthenticated request
// would throw instead of 401; see ADR-0022).

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { parseAndSavePantryItems } from '../../pantry/receipt-ocr.js';
import { getExpiryAlerts } from '../../pantry/expiry-tracker.js';

export default async function pantryRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Upload receipt text (OCR already done on-device) ─────────────────────
  fastify.post('/pantry/receipts', async (request, reply) => {
    requireAuth(request);
    const body = request.body as { text: string };

    if (!body.text?.trim()) return reply.status(400).send({ error: 'text is required' });

    // gateway is optional here — parseReceipt() degrades to a regex-only parse when absent
    // (no LLM key configured), it does not require one like scans.ts's meal-photo route does.
    const { receiptId, itemCount } = await parseAndSavePantryItems({
      userId:  request.user.id,
      text:    body.text,
      supabase: fastify.supabase,
      gateway: fastify.gateway ?? undefined,
    });

    reply.status(201).send({ receiptId, itemCount });
  });

  // ── List pantry items ──────────────────────────────────────────────────────
  fastify.get('/pantry/items', async (request, reply) => {
    requireAuth(request);
    const query = request.query as { consumed?: string; category?: string };

    let q = fastify.supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', request.user.id)
      .order('expiry_date', { nullsFirst: false });

    if (query.consumed !== 'true') q = q.eq('is_consumed', false);
    if (query.category) q = q.eq('category', query.category);

    const { data, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ items: data });
  });

  // ── Add pantry item manually ───────────────────────────────────────────────
  fastify.post('/pantry/items', async (request, reply) => {
    requireAuth(request);
    const body = request.body as {
      name: string; quantity: number; unit: string;
      category?: string; expiryDate?: string; purchaseDate?: string; estimatedRs?: number;
    };

    const { data, error } = await fastify.supabase
      .from('pantry_items')
      .insert({
        user_id:       request.user.id,
        name:          body.name,
        quantity:      body.quantity,
        unit:          body.unit,
        category:      body.category ?? null,
        expiry_date:   body.expiryDate ?? null,
        purchase_date: body.purchaseDate ?? null,
        estimated_rs:  body.estimatedRs ?? null,
        source:        'manual',
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    reply.status(201).send({ item: data });
  });

  // ── Update item (quantity, consumed, expiry) ──────────────────────────────
  fastify.patch<{ Params: { itemId: string } }>('/pantry/items/:itemId', async (request, reply) => {
    requireAuth(request);
    const body = request.body as Partial<{
      quantity: number; unit: string; isConsumed: boolean; expiryDate: string;
    }>;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.quantity    !== undefined) update.quantity     = body.quantity;
    if (body.unit        !== undefined) update.unit         = body.unit;
    if (body.isConsumed  !== undefined) update.is_consumed  = body.isConsumed;
    if (body.expiryDate  !== undefined) update.expiry_date  = body.expiryDate;

    const { data, error } = await fastify.supabase
      .from('pantry_items')
      .update(update)
      .eq('id', request.params.itemId)
      .eq('user_id', request.user.id)
      .select()
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Item not found' });
    reply.send({ item: data });
  });

  // ── Delete pantry item ─────────────────────────────────────────────────────
  fastify.delete<{ Params: { itemId: string } }>('/pantry/items/:itemId', async (request, reply) => {
    requireAuth(request);
    await fastify.supabase.from('pantry_items').delete()
      .eq('id', request.params.itemId)
      .eq('user_id', request.user.id);
    reply.send({ ok: true });
  });

  // ── Expiry alerts ─────────────────────────────────────────────────────────
  fastify.get('/pantry/expiry', async (request, reply) => {
    requireAuth(request);
    const query = request.query as { withinDays?: string };
    const parsed = parseInt(query.withinDays ?? '7', 10);
    const withinDays = Number.isFinite(parsed) ? parsed : 7;

    const alerts = await getExpiryAlerts({ userId: request.user.id, withinDays, supabase: fastify.supabase });
    reply.send({ alerts });
  });

  // ── Receipt list ──────────────────────────────────────────────────────────
  fastify.get('/pantry/receipts', async (request, reply) => {
    requireAuth(request);
    const { data, error } = await fastify.supabase
      .from('pantry_receipts')
      .select('id, store_name, bill_date, total_rs, items_count, status, created_at')
      .eq('user_id', request.user.id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ receipts: data });
  });
}

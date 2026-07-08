// Pantry Intelligence routes.

import type { FastifyInstance } from 'fastify';
import { parseAndSavePantryItems } from '../../pantry/receipt-ocr.js';
import { getExpiryAlerts } from '../../pantry/expiry-tracker.js';

export async function pantryRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Upload receipt text (OCR already done on-device) ─────────────────────
  fastify.post('/api/v1/pantry/receipts', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const body     = request.body as { text: string };

    if (!body.text?.trim()) return reply.status(400).send({ error: 'text is required' });

    const { receiptId, itemCount } = await parseAndSavePantryItems({
      userId:  user.id,
      text:    body.text,
      supabase,
      gateway: (fastify as any).gateway,
    });

    reply.status(201).send({ receiptId, itemCount });
  });

  // ── List pantry items ──────────────────────────────────────────────────────
  fastify.get('/api/v1/pantry/items', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const query    = request.query as { consumed?: string; category?: string };

    let q = supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', user.id)
      .order('expiry_date', { nullsFirst: false });

    if (query.consumed !== 'true') q = q.eq('is_consumed', false);
    if (query.category) q = q.eq('category', query.category);

    const { data, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ items: data });
  });

  // ── Add pantry item manually ───────────────────────────────────────────────
  fastify.post('/api/v1/pantry/items', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const body     = request.body as {
      name: string; quantity: number; unit: string;
      category?: string; expiryDate?: string; purchaseDate?: string; estimatedRs?: number;
    };

    const { data, error } = await supabase
      .from('pantry_items')
      .insert({
        user_id:       user.id,
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
  fastify.patch<{ Params: { itemId: string } }>('/api/v1/pantry/items/:itemId', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const body     = request.body as Partial<{
      quantity: number; unit: string; isConsumed: boolean; expiryDate: string;
    }>;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.quantity    !== undefined) update.quantity     = body.quantity;
    if (body.unit        !== undefined) update.unit         = body.unit;
    if (body.isConsumed  !== undefined) update.is_consumed  = body.isConsumed;
    if (body.expiryDate  !== undefined) update.expiry_date  = body.expiryDate;

    const { data, error } = await supabase
      .from('pantry_items')
      .update(update)
      .eq('id', request.params.itemId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) return reply.status(404).send({ error: 'Item not found' });
    reply.send({ item: data });
  });

  // ── Delete pantry item ─────────────────────────────────────────────────────
  fastify.delete<{ Params: { itemId: string } }>('/api/v1/pantry/items/:itemId', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    await supabase.from('pantry_items').delete()
      .eq('id', request.params.itemId)
      .eq('user_id', user.id);
    reply.send({ ok: true });
  });

  // ── Expiry alerts ─────────────────────────────────────────────────────────
  fastify.get('/api/v1/pantry/expiry', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const query    = request.query as { withinDays?: string };
    const withinDays = parseInt(query.withinDays ?? '7', 10);

    const alerts = await getExpiryAlerts({ userId: user.id, withinDays, supabase });
    reply.send({ alerts });
  });

  // ── Receipt list ──────────────────────────────────────────────────────────
  fastify.get('/api/v1/pantry/receipts', async (request, reply) => {
    const user     = (request as any).user as { id: string };
    const supabase = (fastify as any).supabase;
    const { data, error } = await supabase
      .from('pantry_receipts')
      .select('id, store_name, bill_date, total_rs, items_count, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ receipts: data });
  });
}

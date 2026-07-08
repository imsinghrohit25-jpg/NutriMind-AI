// Family Nutrition Dashboard routes.
// Registered with prefix '/v1' in routes/v1/index.ts — real reachable paths are
// `/v1/family/*` (this file previously hardcoded `/api/v1/family/*`, which never resolved
// to anything real; see ADR-0022).

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import {
  createFamilyGroup,
  addFamilyMember,
  removeFamilyMember,
  validateFamilyMealPlan,
} from '../../family/family-service.js';

interface MealLogRow {
  user_id: string;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_total_g: number | null;
  carbohydrates_g: number | null;
}

export default async function familyRoutes(fastify: FastifyInstance): Promise<void> {
  const supabase = () => fastify.supabase;

  // ── Create family group ──────────────────────────────────────────────────
  fastify.post('/family/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const body = request.body as { name: string };
    const group = await createFamilyGroup({ ownerId: request.user.id, name: body.name, supabase: supabase() });
    reply.status(201).send({ group });
  });

  // ── List my groups ──────────────────────────────────────────────────────
  fastify.get('/family/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);
    const { data, error } = await supabase()
      .from('family_members')
      .select('group_id, role, family_groups(id, name, owner_id, created_at)')
      .eq('user_id', request.user.id);
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ groups: data });
  });

  // ── Add member to group ──────────────────────────────────────────────────
  fastify.post<{ Params: { groupId: string } }>('/family/groups/:groupId/members', async (request, reply) => {
    requireAuth(request);
    const body = request.body as { memberId: string };
    await addFamilyMember({ groupId: request.params.groupId, ownerId: request.user.id, memberId: body.memberId, supabase: supabase() });
    reply.send({ ok: true });
  });

  // ── Remove member (delegates to family-service.ts's ownership-checked, "owner cannot
  //    remove themselves"-guarded implementation, rather than duplicating that logic here) ───
  fastify.delete<{ Params: { groupId: string; memberId: string } }>('/family/groups/:groupId/members/:memberId', async (request, reply) => {
    requireAuth(request);
    try {
      await removeFamilyMember({
        groupId: request.params.groupId,
        ownerId: request.user.id,
        memberId: request.params.memberId,
        supabase: supabase(),
      });
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'unknown error' });
    }
    reply.send({ ok: true });
  });

  // ── Family nutrition dashboard — aggregate daily logs for all members ─────
  fastify.get<{ Params: { groupId: string } }>('/family/groups/:groupId/dashboard', async (request, reply) => {
    requireAuth(request);
    const query = request.query as { date?: string };
    const date  = query.date ?? new Date().toISOString().slice(0, 10);

    const { data: members } = await supabase()
      .from('family_members')
      .select('user_id, role')
      .eq('group_id', request.params.groupId);

    if (!members?.some((m: any) => m.user_id === request.user.id)) {
      return reply.status(403).send({ error: 'Not a member of this group' });
    }

    const memberIds = (members as any[]).map((m) => m.user_id as string);

    // Aggregate meal logs for the date. `meal_logs` (migration 0006) — not the non-existent
    // `food_logs` — with a UTC day range instead of an invalid `.eq('logged_at::date', ...)`
    // raw-cast filter (PostgREST's `.eq()` does not support inline SQL casts).
    const dayStart = `${date}T00:00:00.000Z`;
    const nextDay  = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase()
      .from('meal_logs')
      .select('user_id, energy_kcal, protein_g, fat_total_g, carbohydrates_g')
      .in('user_id', memberIds)
      .gte('logged_at', dayStart)
      .lt('logged_at', nextDay);

    const totals = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const id of memberIds) totals.set(id, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    for (const log of (logs ?? []) as MealLogRow[]) {
      const t = totals.get(log.user_id);
      if (t) {
        t.calories += log.energy_kcal ?? 0;
        t.protein  += log.protein_g ?? 0;
        t.carbs    += log.carbohydrates_g ?? 0;
        t.fat      += log.fat_total_g ?? 0;
      }
    }

    reply.send({
      date,
      members: [...totals.entries()].map(([userId, stats]) => ({ userId, ...stats })),
    });
  });

  // ── Family meal plan validator ────────────────────────────────────────────
  fastify.post<{ Params: { groupId: string; planId: string } }>('/family/groups/:groupId/plans/:planId/validate', async (request, reply) => {
    requireAuth(request);
    const result = await validateFamilyMealPlan({
      groupId: request.params.groupId,
      planId:  request.params.planId,
      userId:  request.user.id,
      supabase: supabase(),
    });
    reply.send(result);
  });

  // ── Shared shopping list ──────────────────────────────────────────────────
  fastify.post<{ Params: { groupId: string } }>('/family/groups/:groupId/shopping', async (request, reply) => {
    requireAuth(request);
    const body = request.body as { title: string };
    const { data, error } = await supabase()
      .from('family_shopping_lists')
      .insert({ group_id: request.params.groupId, created_by: request.user.id, title: body.title })
      .select()
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    reply.status(201).send({ list: data });
  });

  fastify.get<{ Params: { groupId: string } }>('/family/groups/:groupId/shopping', async (request, reply) => {
    requireAuth(request);
    const { data, error } = await supabase()
      .from('family_shopping_lists')
      .select('*')
      .eq('group_id', request.params.groupId)
      .order('created_at', { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ lists: data });
  });

  fastify.get<{ Params: { listId: string } }>('/family/shopping/:listId/items', async (request, reply) => {
    requireAuth(request);
    const { data, error } = await supabase()
      .from('family_shopping_items')
      .select('*')
      .eq('list_id', request.params.listId)
      .order('created_at');
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ items: data });
  });

  fastify.post<{ Params: { listId: string } }>('/family/shopping/:listId/items', async (request, reply) => {
    requireAuth(request);
    const body = request.body as { name: string; quantity?: number; unit?: string };

    const { data: list } = await supabase()
      .from('family_shopping_lists')
      .select('group_id')
      .eq('id', request.params.listId)
      .single();
    if (!list) return reply.status(404).send({ error: 'List not found' });

    const { data, error } = await supabase()
      .from('family_shopping_items')
      .insert({
        list_id:  request.params.listId,
        group_id: (list as any).group_id,
        added_by: request.user.id,
        name:     body.name,
        quantity: body.quantity ?? 1,
        unit:     body.unit ?? 'units',
      })
      .select()
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    reply.status(201).send({ item: data });
  });

  fastify.patch<{ Params: { itemId: string } }>('/family/shopping/items/:itemId/toggle', async (request, reply) => {
    requireAuth(request);
    const { data: existing } = await supabase()
      .from('family_shopping_items')
      .select('is_purchased')
      .eq('id', request.params.itemId)
      .single();
    if (!existing) return reply.status(404).send({ error: 'Item not found' });
    const nowPurchased = !(existing as any).is_purchased;
    await supabase().from('family_shopping_items').update({
      is_purchased: nowPurchased,
      purchased_by: nowPurchased ? request.user.id : null,
    }).eq('id', request.params.itemId);
    reply.send({ ok: true });
  });
}

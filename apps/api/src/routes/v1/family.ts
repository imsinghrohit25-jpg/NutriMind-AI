// Family Nutrition Dashboard routes.

import type { FastifyInstance } from 'fastify';
import { createFamilyGroup, addFamilyMember, validateFamilyMealPlan } from '../../family/family-service.js';

export async function familyRoutes(fastify: FastifyInstance): Promise<void> {
  const supabase = () => (fastify as any).supabase;

  // ── Create family group ──────────────────────────────────────────────────
  fastify.post('/api/v1/family/groups', async (request, reply) => {
    const user = (request as any).user as { id: string };
    const body = request.body as { name: string };
    const group = await createFamilyGroup({ ownerId: user.id, name: body.name, supabase: supabase() });
    reply.status(201).send({ group });
  });

  // ── List my groups ──────────────────────────────────────────────────────
  fastify.get('/api/v1/family/groups', async (request, reply) => {
    const user = (request as any).user as { id: string };
    const { data, error } = await supabase()
      .from('family_members')
      .select('group_id, role, family_groups(id, name, owner_id, created_at)')
      .eq('user_id', user.id);
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ groups: data });
  });

  // ── Add member to group ──────────────────────────────────────────────────
  fastify.post<{ Params: { groupId: string } }>('/api/v1/family/groups/:groupId/members', async (request, reply) => {
    const user = (request as any).user as { id: string };
    const body = request.body as { memberId: string };
    await addFamilyMember({ groupId: request.params.groupId, ownerId: user.id, memberId: body.memberId, supabase: supabase() });
    reply.send({ ok: true });
  });

  // ── Remove member ────────────────────────────────────────────────────────
  fastify.delete<{ Params: { groupId: string; memberId: string } }>('/api/v1/family/groups/:groupId/members/:memberId', async (request, reply) => {
    const user = (request as any).user as { id: string };
    await supabase().from('family_members')
      .delete()
      .eq('group_id', request.params.groupId)
      .eq('user_id', request.params.memberId)
      .in('group_id', (await supabase().from('family_groups').select('id').eq('owner_id', user.id)).data?.map((r: any) => r.id) ?? []);
    reply.send({ ok: true });
  });

  // ── Family nutrition dashboard — aggregate daily logs for all members ─────
  fastify.get<{ Params: { groupId: string } }>('/api/v1/family/groups/:groupId/dashboard', async (request, reply) => {
    const user  = (request as any).user as { id: string };
    const query = request.query as { date?: string };
    const date  = query.date ?? new Date().toISOString().slice(0, 10);

    const { data: members } = await supabase()
      .from('family_members')
      .select('user_id, role')
      .eq('group_id', request.params.groupId);

    if (!members?.some((m: any) => m.user_id === user.id)) {
      return reply.status(403).send({ error: 'Not a member of this group' });
    }

    const memberIds = (members as any[]).map((m) => m.user_id as string);

    // Aggregate calorie logs for the date
    const { data: logs } = await supabase()
      .from('food_logs')
      .select('user_id, calories, protein, carbs, fat')
      .in('user_id', memberIds)
      .eq('logged_at::date', date);

    const totals = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const id of memberIds) totals.set(id, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    for (const log of (logs ?? []) as any[]) {
      const t = totals.get(log.user_id as string);
      if (t) {
        t.calories += (log.calories as number) ?? 0;
        t.protein  += (log.protein  as number) ?? 0;
        t.carbs    += (log.carbs    as number) ?? 0;
        t.fat      += (log.fat      as number) ?? 0;
      }
    }

    reply.send({
      date,
      members: [...totals.entries()].map(([userId, stats]) => ({ userId, ...stats })),
    });
  });

  // ── Family meal plan validator ────────────────────────────────────────────
  fastify.post<{ Params: { groupId: string; planId: string } }>('/api/v1/family/groups/:groupId/plans/:planId/validate', async (request, reply) => {
    const user = (request as any).user as { id: string };
    const result = await validateFamilyMealPlan({
      groupId: request.params.groupId,
      planId:  request.params.planId,
      userId:  user.id,
      supabase: supabase(),
    });
    reply.send(result);
  });

  // ── Shared shopping list ──────────────────────────────────────────────────
  fastify.post<{ Params: { groupId: string } }>('/api/v1/family/groups/:groupId/shopping', async (request, reply) => {
    const user = (request as any).user as { id: string };
    const body = request.body as { title: string };
    const { data, error } = await supabase()
      .from('family_shopping_lists')
      .insert({ group_id: request.params.groupId, created_by: user.id, title: body.title })
      .select()
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    reply.status(201).send({ list: data });
  });

  fastify.get<{ Params: { groupId: string } }>('/api/v1/family/groups/:groupId/shopping', async (request, reply) => {
    const { data, error } = await supabase()
      .from('family_shopping_lists')
      .select('*')
      .eq('group_id', request.params.groupId)
      .order('created_at', { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ lists: data });
  });

  fastify.get<{ Params: { listId: string } }>('/api/v1/family/shopping/:listId/items', async (request, reply) => {
    const { data, error } = await supabase()
      .from('family_shopping_items')
      .select('*')
      .eq('list_id', request.params.listId)
      .order('created_at');
    if (error) return reply.status(500).send({ error: error.message });
    reply.send({ items: data });
  });

  fastify.post<{ Params: { listId: string } }>('/api/v1/family/shopping/:listId/items', async (request, reply) => {
    const user = (request as any).user as { id: string };
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
        added_by: user.id,
        name:     body.name,
        quantity: body.quantity ?? 1,
        unit:     body.unit ?? 'units',
      })
      .select()
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    reply.status(201).send({ item: data });
  });

  fastify.patch<{ Params: { itemId: string } }>('/api/v1/family/shopping/items/:itemId/toggle', async (request, reply) => {
    const user = (request as any).user as { id: string };
    const { data: existing } = await supabase()
      .from('family_shopping_items')
      .select('is_purchased')
      .eq('id', request.params.itemId)
      .single();
    if (!existing) return reply.status(404).send({ error: 'Item not found' });
    const nowPurchased = !(existing as any).is_purchased;
    await supabase().from('family_shopping_items').update({
      is_purchased: nowPurchased,
      purchased_by: nowPurchased ? user.id : null,
    }).eq('id', request.params.itemId);
    reply.send({ ok: true });
  });
}

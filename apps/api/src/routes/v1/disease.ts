// Disease-aware nutrition guidance routes.
// GET /v1/disease/guidance         — cited safe/avoid/recommendation content for the caller's
//                                    stored conditions (users_profiles.conditions).
// GET /v1/disease/guidance?all=1   — the full 10-condition catalogue (for settings/preview UIs).
// Deterministic content from engines/disease/guidance.ts — no LLM, no mock data.

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { CONDITION_GUIDANCE } from '../../engines/disease/guidance.js';
import { CITATIONS } from '../../engines/disease/citations.js';
import { ok } from '@nutrimind/shared';

export default async function diseaseRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { all?: string } }>('/disease/guidance', async (request, reply) => {
    requireAuth(request);

    const wantAll = request.query.all === '1' || request.query.all === 'true';

    let conditions: string[];
    if (wantAll) {
      conditions = Object.keys(CONDITION_GUIDANCE);
    } else {
      const { data } = await fastify.supabase
        .from('users_profiles')
        .select('conditions, reproductive_status')
        .eq('id', request.user.id)
        .maybeSingle();
      conditions = (data?.conditions as string[] | null) ?? [];
      // Structured reproductive_status (migration 0036) surfaces lactation guidance even though
      // there's no matching free-form condition chip for it, and covers pregnancy guidance for
      // users who set the field without also ticking the 'pregnancy' condition.
      const reproductiveStatus = (data?.reproductive_status as string | null) ?? null;
      if (reproductiveStatus === 'pregnant' && !conditions.includes('pregnancy')) conditions = [...conditions, 'pregnancy'];
      if (reproductiveStatus === 'lactating' && !conditions.includes('lactation')) conditions = [...conditions, 'lactation'];
    }

    const guidance = conditions
      .map((c) => CONDITION_GUIDANCE[c])
      .filter((g) => g !== undefined);

    // Resolve the citations actually referenced, so the client renders real sources without
    // shipping the whole registry.
    const citationIds = new Set<string>();
    for (const g of guidance) for (const id of g.citationIds) citationIds.add(id);
    const citations = [...citationIds]
      .map((id) => CITATIONS[id])
      .filter((c) => c !== undefined);

    return reply.send(
      ok({
        conditions,
        guidance,
        citations,
        disclaimer:
          'This is general nutrition information, not medical advice. Consult your doctor or a registered dietitian for personalised guidance.',
      }),
    );
  });
}

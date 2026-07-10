// Multi-Agent System chat route — Phase 13 (§16.2, §17). Registered with prefix '/v1' in
// routes/v1/index.ts — real reachable path is `POST /v1/agent/chat`.
//
// Gated behind `global.p13.multi_agent_system` (global-only row, default disabled) — same
// module-level cached read pattern as country/plugin.ts's own flag check, fails CLOSED (503) on
// missing row/read error, since this is a brand-new, not-yet-rolled-out surface, unlike
// cost-governance.ts's kill switch (an operational off-switch for an already-live surface, which
// fails open by design).
//
// Streams real SSE (agents/sse.ts + supervisor.ts's runSupervisorStream) — see
// runSupervisorStream's own comment for why the final answer is delivered whole in the `done`
// event rather than token-by-token: the Output Guard must validate it first.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { ToolRegistry } from '../../agents/tool-registry.js';
import { runSupervisorStream } from '../../agents/supervisor.js';
import { REAL_AGENT_REGISTRY } from '../../agents/index.js';
import { pipeAgentStream } from '../../agents/sse.js';
import type { ToolContext } from '../../agents/types.js';

const FLAG_KEY = 'global.p13.multi_agent_system';
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000;

let _flagEnabled = false;
let _cacheExpiry = 0;

async function isMultiAgentSystemEnabled(supabase: SupabaseClient): Promise<boolean> {
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
    _flagEnabled = false; // fail closed: an unreleased surface must not open on a DB hiccup
  }

  _cacheExpiry = Date.now() + FLAG_CACHE_TTL_MS;
  return _flagEnabled;
}

/** Reset the flag cache — for testing only. */
export function _resetAgentFlagCache(): void {
  _flagEnabled = false;
  _cacheExpiry = 0;
}

const ChatBodySchema = z.object({
  message: z.string().min(1).max(2000),
  locale: z.string().min(2).max(10).optional(),
});

export default async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/agent/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAuth(request);

    const enabled = await isMultiAgentSystemEnabled(fastify.supabase);
    if (!enabled) {
      return reply.status(503).send({
        ok: false,
        error: { code: 'FEATURE_DISABLED', message: 'The multi-agent assistant is not enabled yet.' },
      });
    }

    const body = ChatBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: body.error.flatten() },
      });
    }

    const ctx: ToolContext = {
      supabase: fastify.supabase,
      sql: fastify.sql,
      gateway: fastify.gateway,
      offClient: fastify.offClient,
      usdaClient: fastify.usdaClient,
      ifct: fastify.ifct,
      cofid: fastify.cofid,
      productCache: fastify.productCache,
      userId: request.user.id,
      countryCode: request.country?.isoCode,
    };

    const registry = new ToolRegistry();
    const events = runSupervisorStream(REAL_AGENT_REGISTRY, {
      message: body.data.message,
      ctx,
      registry,
      locale: body.data.locale ?? 'en-IN',
    });

    await pipeAgentStream(reply, events);
  });
}

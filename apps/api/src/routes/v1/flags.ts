import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

interface FlagRow {
  key: string;
  enabled: boolean;
  country_code: string | null;
  rollout_pct: number;
}

interface FlagsQuery {
  country?: string;
}

export default async function flagRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/flags
   * Returns resolved feature flags for the requesting user's country context.
   *
   * Resolution: country-specific rows take precedence over NULL (global) rows.
   * A flag is enabled if rollout_pct = 100, or deterministically based on user_id hash.
   */
  fastify.get<{ Querystring: FlagsQuery }>(
    '/flags',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Querystring: FlagsQuery }>, reply: FastifyReply) => {
      const supabase = request.supabase as SupabaseClient;
      const userId   = request.user.sub;
      const country  = (request.query.country ?? '').toUpperCase() || null;

      // Fetch all rows relevant to this country (global + country-specific)
      const { data, error } = await supabase
        .from('feature_flags')
        .select('key, enabled, country_code, rollout_pct')
        .or(`country_code.is.null${country ? `,country_code.eq.${country}` : ''}`);

      if (error) {
        request.log.error({ error }, 'feature_flags fetch failed');
        return reply.code(500).send({ error: 'flags_unavailable' });
      }

      const rows = (data ?? []) as FlagRow[];

      // Build resolved map: country-specific rows win over global (null) rows
      const global: Map<string, FlagRow>  = new Map();
      const local:  Map<string, FlagRow>  = new Map();

      for (const row of rows) {
        if (row.country_code === null) {
          global.set(row.key, row);
        } else {
          local.set(row.key, row);
        }
      }

      // Merge: local wins over global
      const merged = new Map<string, FlagRow>([...global, ...local]);

      // Apply rollout_pct via deterministic hash of userId+key
      const resolved: Record<string, boolean> = {};
      for (const [key, row] of merged) {
        if (!row.enabled) {
          resolved[key] = false;
        } else if (row.rollout_pct >= 100) {
          resolved[key] = true;
        } else {
          // Deterministic: hash(userId + key) % 100 < rollout_pct
          resolved[key] = deterministicBucket(userId, key) < row.rollout_pct;
        }
      }

      return reply.code(200).send({ flags: resolved, country: country ?? 'GLOBAL' });
    },
  );
}

/** Deterministic bucket 0–99 for partial rollout. Not crypto — just stable. */
function deterministicBucket(userId: string, flagKey: string): number {
  const str  = `${userId}:${flagKey}`;
  let   hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep 32-bit unsigned
  }
  return hash % 100;
}

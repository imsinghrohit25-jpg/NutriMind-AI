import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';
import { resolveDataRegion } from '../../region/resolver.js';

interface FlagRow {
  key:          string;
  enabled:      boolean;
  country_code: string | null;
  rollout_pct:  number;
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
    {},
    async (request: FastifyRequest<{ Querystring: FlagsQuery }>, reply: FastifyReply) => {
      requireAuth(request);

      const supabase = fastify.supabase;
      const userId   = request.user.id;
      // Use resolved request.country if available, else use query param
      const country  = (
        (request as any).country?.isoCode ??
        request.query.country ??
        ''
      ).toUpperCase() || null;

      // Fetch all rows relevant to this country (global + country-specific)
      const { data, error } = await supabase
        .from('feature_flags')
        .select('key, enabled, country_code, rollout_pct')
        .or(`country_code.is.null${country && country !== 'GLOBAL' ? `,country_code.eq.${country}` : ''}`);

      if (error) {
        request.log.error({ error }, 'feature_flags fetch failed');
        return reply.code(500).send({ error: 'flags_unavailable' });
      }

      const rows = (data ?? []) as FlagRow[];

      // Build resolved map: country-specific rows win over global (null) rows
      const globalRows: Map<string, FlagRow> = new Map();
      const localRows:  Map<string, FlagRow> = new Map();

      for (const row of rows) {
        if (row.country_code === null) {
          globalRows.set(row.key, row);
        } else {
          localRows.set(row.key, row);
        }
      }

      // Merge: local wins over global
      const merged = new Map<string, FlagRow>([...globalRows, ...localRows]);

      // Apply rollout_pct via deterministic hash of userId+key
      const resolved: Record<string, boolean> = {};
      for (const [key, row] of merged) {
        if (!row.enabled) {
          resolved[key] = false;
        } else if (row.rollout_pct >= 100) {
          resolved[key] = true;
        } else {
          resolved[key] = deterministicBucket(userId, key) < row.rollout_pct;
        }
      }

      // Phase 7 (`global.p7.multi_region_routing`) — purely additive field, no existing
      // consumer's parsing of `flags`/`country` changes.
      const region = resolveDataRegion(country ?? 'GLOBAL');

      return reply.code(200).send({ flags: resolved, country: country ?? 'GLOBAL', region });
    },
  );
}

/** Deterministic bucket 0–99 for partial rollout. Not crypto — just stable. */
function deterministicBucket(userId: string, flagKey: string): number {
  const str  = `${userId}:${flagKey}`;
  let   hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash % 100;
}

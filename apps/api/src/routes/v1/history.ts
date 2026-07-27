// Scan-history semantic search — GET /v1/history/search?q=…
// Thin route over the existing memory/semantic-search.ts (embed query → match_scan_history RPC,
// RLS-scoped to the caller). No new search logic; the results map 1:1 onto HistorySearchScreen.

import type { FastifyInstance } from 'fastify';
import { ok, err } from '@nutrimind/shared';
import { requireAuth } from '../../plugins/auth.js';
import { searchScanHistory } from '../../memory/semantic-search.js';

export default async function historyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { q?: string; limit?: string } }>('/history/search', async (request, reply) => {
    requireAuth(request);
    const q = (request.query.q ?? '').trim();
    if (q.length === 0) {
      return reply.status(400).send(err('VALIDATION_ERROR', 'q (search query) is required'));
    }
    // Semantic search needs the embeddings provider; without a configured gateway there's nothing
    // to embed against — return an honest empty result rather than 500.
    if (!fastify.gateway) {
      return reply.send(ok({ query: q, results: [] }));
    }
    const limit = Math.min(Math.max(Number(request.query.limit) || 10, 1), 25);
    const results = await searchScanHistory(request.user.id, q, fastify.supabase, fastify.gateway, limit);
    return reply.send(ok({ query: q, results }));
  });
}

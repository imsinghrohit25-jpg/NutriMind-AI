// Semantic search over scan history — finds past scans by natural-language query.
// Uses pgvector cosine similarity against scan_history_embeddings.
// Gate requirement: history semantic search works; cross-user RLS negative test.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';

export interface HistorySearchResult {
  scanId:      string;
  productName: string;
  healthScore: number;
  band:        string;
  scannedAt:   string;
  similarity:  number;
  category?:   string | null;
}

export async function searchScanHistory(
  userId: string,
  query: string,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
  limit = 10,
): Promise<HistorySearchResult[]> {
  // Embed the user's query
  const embResponse = await gateway.embed({
    input:   query,
    traceId: `history-search:${userId}`,
    userId,
  });
  const queryEmbedding = embResponse.embeddings[0];

  // RPC call to Postgres function match_scan_history(user_id, query_embedding, match_count)
  // This function enforces RLS: it only returns rows WHERE user_id = $1.
  // Cross-user access is blocked at the database level (RLS policy), not here.
  const { data, error } = await supabase.rpc('match_scan_history', {
    p_user_id:        userId,
    query_embedding:  queryEmbedding,
    match_count:      limit,
  }) as {
    data: Array<{
      scan_id: string;
      metadata: { product_name?: string; category?: string };
      health_score: number;
      band: string;
      scanned_at: string;
      similarity: number;
    }> | null;
    error: unknown;
  };

  if (error || !data) return [];

  return data.map((r) => ({
    scanId:      r.scan_id,
    productName: r.metadata?.product_name ?? 'Unknown product',
    healthScore: r.health_score,
    band:        r.band,
    scannedAt:   r.scanned_at,
    similarity:  r.similarity,
    category:    r.metadata?.category ?? null,
  }));
}

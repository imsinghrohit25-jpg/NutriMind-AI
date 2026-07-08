// AI Memory System — Layer 3 (semantic memory). Phase 11 (§12.2).
// Retrieval/ranking only — this layer NEVER produces a "fact" and is never written to
// user_memory_facts. It exists so the context assembler (Layer 4) can pull a handful of
// semantically-similar liked/disliked foods or past feedback text for a prompt, nothing more.
// Uses the existing gateway.embed() (same embeddings task-tier used by
// embeddings/product-pipeline.ts since Phase 0) — no new embedding provider integration.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../gateway/router.js';

export type MemoryEmbeddingRefType = 'liked_food' | 'disliked_food' | 'feedback_text' | 'recipe_interaction';

export async function upsertMemoryEmbedding(
  supabase: SupabaseClient,
  gateway: GatewayRouter,
  userId: string,
  refType: MemoryEmbeddingRefType,
  refId: string,
  textContent: string,
): Promise<void> {
  const embeddingResp = await gateway.embed({ input: [textContent], traceId: crypto.randomUUID() });
  const vector = embeddingResp.embeddings[0];
  if (!vector?.length) throw new Error(`upsertMemoryEmbedding: empty embedding for ${refType}/${refId}`);

  const { error } = await supabase.from('user_memory_embeddings').upsert(
    {
      user_id: userId,
      ref_type: refType,
      ref_id: refId,
      text_content: textContent,
      embedding: vector,
    },
    { onConflict: 'user_id,ref_type,ref_id' },
  );
  if (error) throw new Error(`upsertMemoryEmbedding: ${error.message}`);
}

export interface MemoryEmbeddingMatch {
  refType: MemoryEmbeddingRefType;
  refId: string;
  textContent: string;
  similarity: number;
}

interface MatchRow {
  ref_type: MemoryEmbeddingRefType;
  ref_id: string;
  text_content: string;
  similarity: number;
}

/** Semantically-similar entries for one user via the match_user_memory RPC (migration 0023) —
 *  RLS-safe (SECURITY DEFINER function scoped by the p_user_id argument the caller controls,
 *  same pattern as match_scan_history, migration 0011). */
export async function retrieveSimilarMemories(
  supabase: SupabaseClient,
  gateway: GatewayRouter,
  userId: string,
  queryText: string,
  opts: { refType?: MemoryEmbeddingRefType; limit?: number } = {},
): Promise<MemoryEmbeddingMatch[]> {
  const embeddingResp = await gateway.embed({ input: [queryText], traceId: crypto.randomUUID() });
  const queryEmbedding = embeddingResp.embeddings[0];
  if (!queryEmbedding?.length) return [];

  const { data, error } = await supabase.rpc('match_user_memory', {
    p_user_id: userId,
    query_embedding: queryEmbedding,
    p_ref_type: opts.refType ?? null,
    match_count: opts.limit ?? 10,
  });
  if (error) throw new Error(`retrieveSimilarMemories: ${error.message}`);

  return (data as MatchRow[] ?? []).map((row) => ({
    refType: row.ref_type,
    refId: row.ref_id,
    textContent: row.text_content,
    similarity: row.similarity,
  }));
}

export async function deleteMemoryEmbedding(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('user_memory_embeddings').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`deleteMemoryEmbedding: ${error.message}`);
}

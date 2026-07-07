// Hybrid retrieval — combines BM25 keyword search and vector similarity search.
// BM25 result is from Supabase full-text search (tsvector/tsquery).
// Vector result is from Supabase pgvector `<=>` cosine distance.
// Final results are re-ranked by reciprocal rank fusion (RRF).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../../gateway/router.js';

export interface RetrievedChunk {
  chunkId:    string;
  docId:      string;
  title:      string;
  source:     string;
  year:       number;
  text:       string;
  score:      number;    // RRF score (0–1, higher = more relevant)
  matchType:  'keyword' | 'vector' | 'both';
}

export interface HybridRetrievalOptions {
  topK?:         number;   // final results to return; default 5
  vectorWeight?: number;   // RRF weight for vector results; default 0.6
  keywordWeight?:number;   // RRF weight for keyword results; default 0.4
  minScore?:     number;   // minimum RRF score to include; default 0.1
}

const RRF_K = 60;  // RRF constant

export async function hybridRetrieve(
  query: string,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
  opts: HybridRetrievalOptions = {},
): Promise<RetrievedChunk[]> {
  const topK          = opts.topK          ?? 5;
  const vectorWeight  = opts.vectorWeight  ?? 0.6;
  const keywordWeight = opts.keywordWeight ?? 0.4;
  const minScore      = opts.minScore      ?? 0.1;

  const candidateK = Math.ceil(topK * 3);  // retrieve more candidates before RRF

  // Run keyword and vector searches in parallel
  const [keywordResults, vectorResults] = await Promise.all([
    bm25Search(query, candidateK, supabase),
    vectorSearch(query, candidateK, supabase, gateway),
  ]);

  return reciprocalRankFusion(
    keywordResults,
    vectorResults,
    vectorWeight,
    keywordWeight,
    topK,
    minScore,
  );
}

// ── BM25 keyword search via Supabase full-text ─────────────────────────────────

async function bm25Search(
  query: string,
  limit: number,
  supabase: SupabaseClient,
): Promise<Array<{ chunkId: string; rank: number }>> {
  // Supabase full-text search via RPC (match_knowledge_bm25 Postgres function)
  // Function: SELECT id, ts_rank(to_tsvector('english', text), plainto_tsquery('english', $1)) AS rank
  //   FROM knowledge_chunks WHERE to_tsvector('english', text) @@ plainto_tsquery('english', $1)
  //   ORDER BY rank DESC LIMIT $2
  const { data, error } = await supabase.rpc('match_knowledge_bm25', {
    query_text:  query,
    match_count: limit,
  }) as { data: Array<{ id: string; rank: number }> | null; error: unknown };

  if (error || !data) return [];

  return data.map((r) => ({ chunkId: r.id, rank: r.rank }));
}

// ── Vector search via pgvector ────────────────────────────────────────────────

async function vectorSearch(
  query: string,
  limit: number,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
): Promise<Array<{ chunkId: string; rank: number }>> {
  const embResponse = await gateway.embed({ input: query, traceId: `retrieval:${Date.now()}` });
  const embedding = embResponse.embeddings[0];

  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_count:     limit,
  });

  if (error || !data) return [];

  return (data as Array<{ id: string; similarity: number }>).map((r, i) => ({
    chunkId: r.id,
    rank: r.similarity,  // cosine similarity (1 = exact match)
  }));
}

// ── Reciprocal Rank Fusion ────────────────────────────────────────────────────

function reciprocalRankFusion(
  keywordResults: Array<{ chunkId: string; rank: number }>,
  vectorResults:  Array<{ chunkId: string; rank: number }>,
  vectorWeight:   number,
  keywordWeight:  number,
  topK:           number,
  minScore:       number,
): RetrievedChunk[] {
  const scores = new Map<string, { vector: number; keyword: number }>();

  keywordResults.forEach((r, i) => {
    const current = scores.get(r.chunkId) ?? { vector: 0, keyword: 0 };
    current.keyword = 1 / (RRF_K + i + 1);
    scores.set(r.chunkId, current);
  });

  vectorResults.forEach((r, i) => {
    const current = scores.get(r.chunkId) ?? { vector: 0, keyword: 0 };
    current.vector = 1 / (RRF_K + i + 1);
    scores.set(r.chunkId, current);
  });

  const ranked = Array.from(scores.entries())
    .map(([chunkId, s]) => ({
      chunkId,
      score: s.vector * vectorWeight + s.keyword * keywordWeight,
      matchType: (s.vector > 0 && s.keyword > 0 ? 'both' : s.vector > 0 ? 'vector' : 'keyword') as RetrievedChunk['matchType'],
    }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Placeholder: in production, fetch full chunk data in a single query
  return ranked.map((r) => ({
    chunkId:   r.chunkId,
    docId:     '',
    title:     '',
    source:    '',
    year:      0,
    text:      '',
    score:     r.score,
    matchType: r.matchType,
  }));
}

// Fetch full chunk data for a list of chunkIds
export async function fetchChunks(
  chunkIds: string[],
  supabase: SupabaseClient,
): Promise<RetrievedChunk[]> {
  if (chunkIds.length === 0) return [];

  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('id, doc_id, title, source, year, text')
    .in('id', chunkIds);

  if (error || !data) return [];

  return (data as Array<{
    id: string; doc_id: string; title: string;
    source: string; year: number; text: string;
  }>).map((r) => ({
    chunkId:   r.id,
    docId:     r.doc_id,
    title:     r.title,
    source:    r.source,
    year:      r.year,
    text:      r.text,
    score:     0,
    matchType: 'both',
  }));
}

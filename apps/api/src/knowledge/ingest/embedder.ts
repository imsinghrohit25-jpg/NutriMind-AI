// Embedder — generates text embeddings for knowledge chunks and stores them in Supabase pgvector.
// Uses the gateway's embedding endpoint. The embedding model is configured in gateway config.
// Chunks are upserted to the `knowledge_chunks` table in Supabase.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GatewayRouter } from '../../gateway/router.js';
import type { KnowledgeChunk } from './chunker.js';

export interface EmbedResult {
  chunkId:  string;
  embedded: boolean;
  error?:   string;
}

// Supabase table schema (must match migration):
// knowledge_chunks(id text PK, doc_id text, title text, source text, year int,
//   text text, metadata jsonb, embedding vector(1536), corpus_version text)

export async function embedAndStore(
  chunks: KnowledgeChunk[],
  corpusVersion: string,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
): Promise<EmbedResult[]> {
  const results: EmbedResult[] = [];

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 20;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((chunk) => embedOne(chunk, corpusVersion, supabase, gateway)),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Re-embeds a single already-ingested chunk by id — the `embed-knowledge-chunk` pg-boss job's
 * real handler. Ingestion (`embedAndStore`) inserts text+embedding together for a fresh batch;
 * this path is for backfill/re-embedding an existing row (e.g. after a model change), so it
 * fetches the row's existing text/metadata rather than requiring the caller to resupply it.
 */
export async function embedChunkById(
  chunkId: string,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
): Promise<EmbedResult> {
  const { data: row, error } = await supabase
    .from('knowledge_chunks')
    .select('id, doc_id, title, source, year, text, metadata, corpus_version')
    .eq('id', chunkId)
    .single();

  if (error || !row) {
    return { chunkId, embedded: false, error: error?.message ?? 'chunk not found' };
  }

  const chunk: KnowledgeChunk = {
    chunkId:  row.id as string,
    docId:    row.doc_id as string,
    title:    row.title as string,
    source:   row.source as string,
    year:     row.year as number,
    text:     row.text as string,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };

  return embedOne(chunk, (row.corpus_version as string) ?? 'unknown', supabase, gateway);
}

async function embedOne(
  chunk: KnowledgeChunk,
  corpusVersion: string,
  supabase: SupabaseClient,
  gateway: GatewayRouter,
): Promise<EmbedResult> {
  try {
    const embResponse = await gateway.embed({ input: chunk.text, traceId: `ingest:${chunk.chunkId}` });
    const embedding = embResponse.embeddings[0];

    const { error } = await supabase.from('knowledge_chunks').upsert({
      id:             chunk.chunkId,
      doc_id:         chunk.docId,
      title:          chunk.title,
      source:         chunk.source,
      year:           chunk.year,
      text:           chunk.text,
      metadata:       chunk.metadata,
      embedding,
      corpus_version: corpusVersion,
    });

    if (error) throw new Error(error.message);

    return { chunkId: chunk.chunkId, embedded: true };
  } catch (err) {
    return { chunkId: chunk.chunkId, embedded: false, error: String(err) };
  }
}

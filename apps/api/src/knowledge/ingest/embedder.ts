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

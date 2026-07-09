// Semantic (embedding-similarity) response cache — Phase 12 (§13.3). Distinct from cache.ts's
// exact-match SHA-256 cache: this one matches semantically-similar *phrasings* of the same
// informational question (e.g. "what is sodium?" vs "explain sodium to me"), at the cost of one
// extra (cheap) embedding call per lookup — a real, documented tradeoff, not free.
//
// Scope is intentionally narrow: only requests explicitly marked `cacheScope: 'global'` are ever
// looked up or stored here. Anything else (the default) must never be cached across users
// (§13.3: "personalization-bearing responses are NEVER cached across users").

import type { LLMRequest, LLMResponse } from '@nutrimind/shared';

interface SemanticEntry {
  key: string; // `${tier}:${language}:${country}` partition — never matches across tiers/locales
  embedding: number[];
  response: LLMResponse;
  expiresAt: number;
}

export interface EmbedFn {
  (text: string): Promise<number[]>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SemanticCache {
  private readonly entries: SemanticEntry[] = [];

  constructor(
    private readonly similarityThreshold = 0.92,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly maxEntriesPerPartition = 200,
  ) {}

  private partitionKey(request: LLMRequest, language: string, country: string): string {
    return `${request.tier}:${language}:${country}`;
  }

  private queryText(request: LLMRequest): string {
    return request.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  }

  async lookup(
    request: LLMRequest,
    embed: EmbedFn,
    language = 'en',
    country = 'GLOBAL',
  ): Promise<LLMResponse | null> {
    if (request.cacheScope !== 'global') return null;

    const partition = this.partitionKey(request, language, country);
    const candidates = this.entries.filter((e) => e.key === partition && e.expiresAt > Date.now());
    if (candidates.length === 0) return null;

    const queryEmbedding = await embed(this.queryText(request));

    let best: { entry: SemanticEntry; similarity: number } | null = null;
    for (const entry of candidates) {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= this.similarityThreshold && (!best || similarity > best.similarity)) {
        best = { entry, similarity };
      }
    }

    return best ? { ...best.entry.response, cached: true } : null;
  }

  async store(
    request: LLMRequest,
    response: LLMResponse,
    embed: EmbedFn,
    language = 'en',
    country = 'GLOBAL',
  ): Promise<void> {
    if (request.cacheScope !== 'global') return;

    const partition = this.partitionKey(request, language, country);
    const embedding = await embed(this.queryText(request));

    this.evictExpired();
    const partitionEntries = this.entries.filter((e) => e.key === partition);
    if (partitionEntries.length >= this.maxEntriesPerPartition) {
      // Evict the oldest entry in this partition (simple FIFO — this is a bounded in-process
      // cache, not a durable store; a K8s-deployed gateway would back this with Redis/KV instead).
      const oldestIndex = this.entries.findIndex((e) => e === partitionEntries[0]);
      if (oldestIndex >= 0) this.entries.splice(oldestIndex, 1);
    }

    this.entries.push({ key: partition, embedding, response, expiresAt: Date.now() + this.ttlMs });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i]!.expiresAt <= now) this.entries.splice(i, 1);
    }
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries.length = 0;
  }
}

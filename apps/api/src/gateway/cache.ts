import type { LLMRequest, LLMResponse } from '@nutrimind/shared';
import crypto from 'node:crypto';

interface CacheEntry {
  response: LLMResponse;
  expiresAt: number;
}

export class GatewayCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
    setInterval(() => this.evict(), 60_000).unref();
  }

  private makeKey(request: LLMRequest): string {
    const payload = {
      tier: request.tier,
      messages: request.messages,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature ?? 0,
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  get(request: LLMRequest): LLMResponse | null {
    if ((request.temperature ?? 0.7) > 0) return null;

    const key = this.makeKey(request);
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return { ...entry.response, cached: true };
  }

  set(request: LLMRequest, response: LLMResponse): void {
    if ((request.temperature ?? 0.7) > 0) return;

    const key = this.makeKey(request);
    this.store.set(key, {
      response,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// Generic in-process TTL cache — Phase 7 (`global.p7.edge_caching`).
// Same shape as `gateway/cache.ts`'s `GatewayCache` (Map + TTL + periodic eviction), generalized
// beyond LLM responses so any hot, read-heavy lookup (barcode resolution today; nutrition
// standards/grocery providers are cheap in-memory lookups already and don't need this) can get
// an in-process fast path in front of its DB-backed cache, without a new external dependency
// (Redis, Memcached, a CDN edge-compute product) this environment has no credentials for.

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface EdgeCacheStats {
  hits: number;
  misses: number;
  size: number;
}

export class EdgeCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(ttlMs = 5 * 60 * 1000, maxEntries = 5000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    setInterval(() => this.evict(), 60_000).unref();
  }

  /** Returns the cached value, or `undefined` on a miss (expired or never set). */
  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.store.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  set(key: string, value: V): void {
    // Bound memory: evict the oldest entry (Map preserves insertion order) rather than growing
    // unboundedly — a barcode-keyed cache on a long-lived process could otherwise accumulate
    // every distinct barcode ever scanned.
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get stats(): EdgeCacheStats {
    return { hits: this.hits, misses: this.misses, size: this.store.size };
  }

  get size(): number {
    return this.store.size;
  }
}

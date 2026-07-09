// Backpressure & fairness — Phase 12 (§13.3). Per-user token bucket (fairness: one user can't
// starve others of gateway capacity) plus a global concurrency cap (protects the LLM providers
// and this process from being overwhelmed). Overflow is a typed, catchable error so callers
// (routes, jobs) can surface "high demand, try again shortly" instead of a raw timeout.

export class GatewayOverloadedError extends Error {
  constructor(public readonly reason: 'user_rate_limited' | 'global_concurrency_limited') {
    super(`AI gateway overloaded: ${reason}`);
    this.name = 'GatewayOverloadedError';
  }
}

interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

export class GatewayBackpressure {
  private readonly buckets = new Map<string, TokenBucketState>();
  private inFlight = 0;

  constructor(
    private readonly perUserCapacity = 10,
    private readonly perUserRefillPerSec = 10 / 60, // ~10 requests/min/user
    private readonly globalConcurrencyLimit = 50,
  ) {}

  private takeUserToken(userId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = { tokens: this.perUserCapacity, lastRefillMs: now };
      this.buckets.set(userId, bucket);
    }

    const elapsedSec = (now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(this.perUserCapacity, bucket.tokens + elapsedSec * this.perUserRefillPerSec);
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** Acquire capacity for one gateway call. Throws GatewayOverloadedError on overflow — never
   *  silently queues indefinitely (a bounded, fast-failing signal beats an unbounded queue that
   *  just moves the problem to a request timeout instead). Callers that hold the slot MUST call
   *  the returned `release()` in a `finally` block. */
  acquire(userId: string | undefined): { release: () => void } {
    if (userId && !this.takeUserToken(userId)) {
      throw new GatewayOverloadedError('user_rate_limited');
    }
    if (this.inFlight >= this.globalConcurrencyLimit) {
      throw new GatewayOverloadedError('global_concurrency_limited');
    }
    this.inFlight++;
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.inFlight--;
      },
    };
  }

  get currentInFlight(): number {
    return this.inFlight;
  }
}

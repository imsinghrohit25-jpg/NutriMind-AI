type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  successThreshold?: number;
}

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt?: number;

  constructor(
    readonly name: string,
    private readonly opts: Required<CircuitBreakerOptions> = {
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      successThreshold: 2,
    },
  ) {}

  get currentState(): State {
    return this.state;
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.openedAt ?? 0) >= this.opts.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.consecutiveSuccesses = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(`Circuit breaker OPEN for ${this.name}`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.opts.successThreshold) {
        this.state = 'CLOSED';
        this.consecutiveSuccesses = 0;
      }
    }
  }

  private onFailure(): void {
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures++;
    if (
      this.state !== 'OPEN' &&
      this.consecutiveFailures >= this.opts.failureThreshold
    ) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.openedAt = undefined;
  }
}

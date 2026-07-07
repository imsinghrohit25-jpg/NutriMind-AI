export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: string,
    public readonly retryable: boolean = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class ProviderUnavailableError extends GatewayError {
  constructor(provider: string, cause?: unknown) {
    super(`Provider ${provider} is unavailable`, 'PROVIDER_UNAVAILABLE', provider, true, cause);
    this.name = 'ProviderUnavailableError';
  }
}

export class AllProvidersFailedError extends GatewayError {
  constructor(tier: string, errors: Error[]) {
    super(
      `All providers failed for tier ${tier}: ${errors.map((e) => e.message).join('; ')}`,
      'ALL_PROVIDERS_FAILED',
      undefined,
      false,
    );
    this.name = 'AllProvidersFailedError';
  }
}

export class RateLimitError extends GatewayError {
  constructor(provider: string, retryAfterMs?: number) {
    super(`Rate limit hit on ${provider}`, 'PROVIDER_RATE_LIMIT', provider, true);
    this.name = 'RateLimitError';
    if (retryAfterMs) Object.assign(this, { retryAfterMs });
  }
}

export class ContextLengthError extends GatewayError {
  constructor(provider: string) {
    super(`Context length exceeded on ${provider}`, 'CONTEXT_LENGTH_EXCEEDED', provider, false);
    this.name = 'ContextLengthError';
  }
}

export class OutputPolicyViolationError extends Error {
  constructor(
    public readonly violations: string[],
    public readonly content: string,
  ) {
    super(`Output policy violation: ${violations.join(', ')}`);
    this.name = 'OutputPolicyViolationError';
  }
}

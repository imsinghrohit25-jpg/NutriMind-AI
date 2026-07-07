import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayRouter } from '../router.js';
import { GatewayCache } from '../cache.js';
import type { LLMProvider } from '../provider.js';
import type { LLMRequest, LLMResponse, EmbeddingRequest, EmbeddingResponse } from '@nutrimind/shared';

const ROUTING_CONFIG = {
  parse_assist: {
    primary: { provider: 'mock-a', model: 'model-fast' },
    fallbacks: [{ provider: 'mock-b', model: 'model-slow' }],
    maxRetries: 2,
    timeoutMs: 5000,
  },
  embeddings: {
    primary: { provider: 'mock-embed', model: 'embed-model' },
    fallbacks: [],
    maxRetries: 1,
    timeoutMs: 5000,
  },
};

function makeMockProvider(
  name: string,
  overrides?: Partial<LLMProvider>,
): LLMProvider {
  return {
    name,
    isAvailable: () => true,
    complete: vi.fn(async (_req: LLMRequest, model: string): Promise<LLMResponse> => ({
      content: `response from ${name}`,
      provider: name,
      model,
      promptTokens: 10,
      completionTokens: 20,
      costUsd: 0.001,
      latencyMs: 50,
      cached: false,
      traceId: _req.traceId,
    })),
    ...overrides,
  };
}

function makeMockCostLogger() {
  return {
    logFromLLMResponse: vi.fn(async () => {}),
    logFromEmbeddingResponse: vi.fn(async () => {}),
    log: vi.fn(async () => {}),
  };
}

const BASE_REQUEST: LLMRequest = {
  tier: 'parse_assist',
  messages: [{ role: 'user', content: 'Test message' }],
  traceId: 'trace-123',
  temperature: 0,
};

describe('GatewayRouter', () => {
  let providerA: LLMProvider;
  let providerB: LLMProvider;
  let costLogger: ReturnType<typeof makeMockCostLogger>;
  let cache: GatewayCache;
  let router: GatewayRouter;

  beforeEach(() => {
    providerA = makeMockProvider('mock-a');
    providerB = makeMockProvider('mock-b');
    costLogger = makeMockCostLogger();
    cache = new GatewayCache();

    const providers = new Map<string, LLMProvider>([
      ['mock-a', providerA],
      ['mock-b', providerB],
    ]);
    router = new GatewayRouter(providers, ROUTING_CONFIG as never, costLogger as never, cache);
  });

  it('routes to primary provider by default', async () => {
    const response = await router.complete(BASE_REQUEST);
    expect(response.provider).toBe('mock-a');
    expect(response.content).toBe('response from mock-a');
  });

  it('falls back to secondary when primary fails', async () => {
    (providerA.complete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Provider error'),
    );
    const response = await router.complete(BASE_REQUEST);
    expect(response.provider).toBe('mock-b');
  });

  it('logs cost after successful completion', async () => {
    await router.complete(BASE_REQUEST);
    expect(costLogger.logFromLLMResponse).toHaveBeenCalledOnce();
  });

  it('returns cached response on second identical request', async () => {
    await router.complete(BASE_REQUEST);
    await router.complete(BASE_REQUEST);
    expect(providerA.complete).toHaveBeenCalledOnce();
    expect(costLogger.logFromLLMResponse).toHaveBeenCalledTimes(2);
  });

  it('does not cache non-zero temperature requests', async () => {
    const req = { ...BASE_REQUEST, temperature: 0.7 };
    await router.complete(req);
    await router.complete(req);
    expect(providerA.complete).toHaveBeenCalledTimes(2);
  });

  it('throws AllProvidersFailedError when all fail', async () => {
    (providerA.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('A down'));
    (providerB.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('B down'));

    await expect(router.complete(BASE_REQUEST)).rejects.toThrow(
      /all providers failed/i,
    );
  });

  it('exposes circuit breaker states', () => {
    const states = router.getCircuitBreakerStates();
    expect(states['mock-a']).toBe('CLOSED');
    expect(states['mock-b']).toBe('CLOSED');
  });

  it('routes embeddings to embed provider', async () => {
    const embedProvider: LLMProvider = {
      name: 'mock-embed',
      isAvailable: () => true,
      complete: vi.fn(),
      embed: vi.fn(async (_req: EmbeddingRequest, model: string): Promise<EmbeddingResponse> => ({
        embeddings: [[0.1, 0.2, 0.3]],
        model,
        provider: 'mock-embed',
        totalTokens: 5,
        costUsd: 0.0001,
        latencyMs: 20,
      })),
    };

    const providers = new Map<string, LLMProvider>([
      ['mock-a', providerA],
      ['mock-embed', embedProvider],
    ]);
    const embedRouter = new GatewayRouter(
      providers,
      ROUTING_CONFIG as never,
      costLogger as never,
      cache,
    );

    const result = await embedRouter.embed({
      input: 'test text',
      traceId: 'trace-embed',
    });
    expect(result.provider).toBe('mock-embed');
    expect(result.embeddings).toHaveLength(1);
  });
});

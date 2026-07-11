import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayRouter } from '../router.js';
import { GatewayCache } from '../cache.js';
import { SemanticCache } from '../semantic-cache.js';
import { GatewayBackpressure, GatewayOverloadedError } from '../backpressure.js';
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

  // Phase 12 (§13.3) additions —————————————————————————————————————————————

  it('T0: renders a deterministic template without calling any provider', async () => {
    const response = await router.complete({ ...BASE_REQUEST, intentTag: 'ack_received' });
    expect(response.content).toBe('Got it — noted.');
    expect(response.provider).toBe('t0-template');
    expect(response.costUsd).toBe(0);
    expect(providerA.complete).not.toHaveBeenCalled();
    expect(costLogger.logFromLLMResponse).toHaveBeenCalledOnce();
  });

  it('T1: kill switch active routes to the tier\'s fast target instead of primary', async () => {
    const providerFast = makeMockProvider('mock-fast');
    const providers = new Map<string, LLMProvider>([
      ['mock-a', providerA],
      ['mock-fast', providerFast],
    ]);
    const configWithFast = {
      ...ROUTING_CONFIG,
      parse_assist: { ...ROUTING_CONFIG.parse_assist, fast: { provider: 'mock-fast', model: 'model-tiny' } },
    };
    const killSwitchRouter = new GatewayRouter(
      providers, configWithFast as never, costLogger as never, new GatewayCache(),
      { killSwitch: () => true },
    );

    const response = await killSwitchRouter.complete(BASE_REQUEST);
    expect(response.provider).toBe('mock-fast');
    expect(providerA.complete).not.toHaveBeenCalled();
  });

  it('does not route to the fast target when the kill switch is inactive', async () => {
    const providerFast = makeMockProvider('mock-fast');
    const providers = new Map<string, LLMProvider>([
      ['mock-a', providerA],
      ['mock-fast', providerFast],
    ]);
    const configWithFast = {
      ...ROUTING_CONFIG,
      parse_assist: { ...ROUTING_CONFIG.parse_assist, fast: { provider: 'mock-fast', model: 'model-tiny' } },
    };
    const normalRouter = new GatewayRouter(
      providers, configWithFast as never, costLogger as never, new GatewayCache(),
      { killSwitch: () => false },
    );

    const response = await normalRouter.complete(BASE_REQUEST);
    expect(response.provider).toBe('mock-a');
  });

  it('rejects with GatewayOverloadedError when backpressure capacity is exhausted', async () => {
    const backpressure = new GatewayBackpressure(0, 0, 50); // zero user-bucket capacity
    const limitedRouter = new GatewayRouter(
      new Map([['mock-a', providerA]]), ROUTING_CONFIG as never, costLogger as never, new GatewayCache(),
      { backpressure },
    );

    await expect(
      limitedRouter.complete({ ...BASE_REQUEST, userId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toThrow(GatewayOverloadedError);
  });

  it('semantic cache serves a cross-request hit for cacheScope=global requests', async () => {
    const embedProvider: LLMProvider = {
      name: 'mock-embed',
      isAvailable: () => true,
      complete: vi.fn(),
      embed: vi.fn(async (_req: EmbeddingRequest, model: string): Promise<EmbeddingResponse> => ({
        embeddings: [[1, 0, 0]],
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
    const semanticRouter = new GatewayRouter(
      providers, ROUTING_CONFIG as never, costLogger as never, new GatewayCache(),
      { semanticCache: new SemanticCache() },
    );

    const req1: LLMRequest = { ...BASE_REQUEST, cacheScope: 'global', temperature: 0.9, messages: [{ role: 'user', content: 'What is sodium?' }] };
    const req2: LLMRequest = { ...BASE_REQUEST, cacheScope: 'global', temperature: 0.9, messages: [{ role: 'user', content: 'Explain sodium please' }] };

    await semanticRouter.complete(req1);
    const response2 = await semanticRouter.complete(req2);

    // Same fixed embedding [1,0,0] for both mock texts => cosine similarity 1.0 => cache hit,
    // so the provider is called exactly once despite two different-text requests.
    expect(providerA.complete).toHaveBeenCalledOnce();
    expect(response2.cached).toBe(true);
  });

  // Phase 13 (§16.2) — real streaming ————————————————————————————————————————

  async function* fakeStream(chunks: string[], finalResponse: Omit<LLMResponse, 'content'>): AsyncGenerator<string, LLMResponse, void> {
    for (const chunk of chunks) yield chunk;
    return { ...finalResponse, content: chunks.join('') };
  }

  it('completeStream yields real incremental chunks and returns the final response', async () => {
    const streamingProvider = makeMockProvider('mock-a', {
      completeStream: vi.fn(() => fakeStream(['Hello', ', ', 'world'], {
        provider: 'mock-a', model: 'model-fast', promptTokens: 5, completionTokens: 3,
        costUsd: 0.001, latencyMs: 40, cached: false, traceId: 'trace-123',
      })),
    });
    const streamRouter = new GatewayRouter(
      new Map([['mock-a', streamingProvider]]), ROUTING_CONFIG as never, costLogger as never, cache,
    );

    const received: string[] = [];
    const gen = streamRouter.completeStream(BASE_REQUEST);
    let result = await gen.next();
    while (!result.done) {
      received.push(result.value);
      result = await gen.next();
    }

    expect(received).toEqual(['Hello', ', ', 'world']);
    expect(result.value.content).toBe('Hello, world');
    expect(costLogger.logFromLLMResponse).toHaveBeenCalledOnce();
  });

  it('T0 templates stream as a single chunk (nothing to stream — no provider call at all)', async () => {
    const streamRouter = new GatewayRouter(
      new Map([['mock-a', providerA]]), ROUTING_CONFIG as never, costLogger as never, new GatewayCache(),
    );
    const chunks: string[] = [];
    const gen = streamRouter.completeStream({ ...BASE_REQUEST, intentTag: 'ack_received' });
    let result = await gen.next();
    while (!result.done) { chunks.push(result.value); result = await gen.next(); }

    expect(chunks).toEqual(['Got it — noted.']);
    expect(providerA.complete).not.toHaveBeenCalled();
  });

  it('falls back to the next provider when the FIRST target fails before yielding any chunk', async () => {
    const failingProvider = makeMockProvider('mock-a', {
      completeStream: vi.fn(() => {
        throw new Error('connection refused');
      }) as never,
    });
    const workingProvider = makeMockProvider('mock-b', {
      completeStream: vi.fn(() => fakeStream(['fallback', ' response'], {
        provider: 'mock-b', model: 'model-slow', promptTokens: 5, completionTokens: 3,
        costUsd: 0.001, latencyMs: 40, cached: false, traceId: 'trace-123',
      })),
    });
    const streamRouter = new GatewayRouter(
      new Map([['mock-a', failingProvider], ['mock-b', workingProvider]]),
      ROUTING_CONFIG as never, costLogger as never, new GatewayCache(),
    );

    const chunks: string[] = [];
    const gen = streamRouter.completeStream(BASE_REQUEST);
    let result = await gen.next();
    while (!result.done) { chunks.push(result.value); result = await gen.next(); }

    expect(chunks.join('')).toBe('fallback response');
    expect(result.value.provider).toBe('mock-b');
  });

  it('does NOT fall back once a chunk has already reached the caller — surfaces the interruption instead', async () => {
    async function* partialThenFail(): AsyncGenerator<string, LLMResponse, void> {
      yield 'partial ';
      throw new Error('stream interrupted mid-flight');
    }
    const flakyProvider = makeMockProvider('mock-a', { completeStream: vi.fn(() => partialThenFail()) });
    const neverCalledProvider = makeMockProvider('mock-b', { completeStream: vi.fn(() => fakeStream(['should not be reached'], {
      provider: 'mock-b', model: 'model-slow', promptTokens: 1, completionTokens: 1, costUsd: 0, latencyMs: 1, cached: false, traceId: 't',
    })) });
    const streamRouter = new GatewayRouter(
      new Map([['mock-a', flakyProvider], ['mock-b', neverCalledProvider]]),
      ROUTING_CONFIG as never, costLogger as never, new GatewayCache(),
    );

    const gen = streamRouter.completeStream(BASE_REQUEST);
    const first = await gen.next();
    expect(first.value).toBe('partial ');
    await expect(gen.next()).rejects.toThrow('stream interrupted mid-flight');
    expect(neverCalledProvider.completeStream).not.toHaveBeenCalled();
  });

  it('redacts PII from the request before ANY provider sees it (gateway/pii-redaction.ts)', async () => {
    const piiRequest: LLMRequest = {
      tier: 'parse_assist',
      messages: [{ role: 'user', content: 'my email is asha@example.com and phone is 9876543210' }],
      systemPrompt: 'user PAN: ABCDE1234F',
      traceId: 'trace-pii',
    };
    await router.complete(piiRequest);

    const seenRequest = (providerA.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0] as LLMRequest;
    expect(seenRequest.messages[0]!.content).toBe('my email is [redacted-email] and phone is [redacted-phone]');
    expect(seenRequest.systemPrompt).toBe('user PAN: [redacted-pan]');
  });
});

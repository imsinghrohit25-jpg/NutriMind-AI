// Provider conformance suite — Gemini integration addendum. No shared test previously ran against
// every LLMProvider adapter (confirmed by direct search: gateway/__tests__/ only covers
// router/circuit-breaker/backpressure/cost-governance/model-tier, no gateway/adapters/__tests__
// directory existed). This suite exercises the real adapter code (not just a TypeScript interface
// check) by mocking each underlying SDK module — none of the adapters accept an injectable client
// (each constructs its own internally), so module-level mocking is the only way to reach the real
// request-building/response-parsing/error-mapping logic without a live API key. Real SDK error
// classes (Anthropic.RateLimitError, OpenAI.RateLimitError) are preserved via `importOriginal` so
// each adapter's own `err instanceof X.RateLimitError` check is exercised for real, not assumed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimitError, GatewayError } from '../../errors.js';
import type { LLMRequest } from '@nutrimind/shared';

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  const instances: { messages: { create: ReturnType<typeof vi.fn>; stream: ReturnType<typeof vi.fn> } }[] = [];
  class MockAnthropic {
    messages = { create: vi.fn(), stream: vi.fn() };
    constructor() { instances.push(this); }
  }
  (MockAnthropic as unknown as Record<string, unknown>).RateLimitError = actual.default.RateLimitError;
  (MockAnthropic as unknown as Record<string, unknown>).BadRequestError = actual.default.BadRequestError;
  (MockAnthropic as unknown as Record<string, unknown>).__instances = instances;
  return { default: MockAnthropic };
});

vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>();
  const instances: {
    chat: { completions: { create: ReturnType<typeof vi.fn> } };
    embeddings: { create: ReturnType<typeof vi.fn> };
  }[] = [];
  class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
    embeddings = { create: vi.fn() };
    constructor() { instances.push(this); }
  }
  (MockOpenAI as unknown as Record<string, unknown>).RateLimitError = actual.default.RateLimitError;
  (MockOpenAI as unknown as Record<string, unknown>).BadRequestError = actual.default.BadRequestError;
  (MockOpenAI as unknown as Record<string, unknown>).__instances = instances;
  return { default: MockOpenAI };
});

vi.mock('@google/generative-ai', () => {
  const instances: {
    model: { generateContent: ReturnType<typeof vi.fn>; generateContentStream: ReturnType<typeof vi.fn>; embedContent: ReturnType<typeof vi.fn> };
    getGenerativeModel: ReturnType<typeof vi.fn>;
  }[] = [];
  class MockGoogleGenerativeAI {
    model = { generateContent: vi.fn(), generateContentStream: vi.fn(), embedContent: vi.fn() };
    getGenerativeModel = vi.fn(() => this.model);
    constructor() { instances.push(this); }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI, __instances: instances };
});

const BASE_REQUEST: LLMRequest = {
  tier: 'parse_assist',
  messages: [{ role: 'user', content: 'hello' }],
  traceId: 'trace-conformance',
};

describe('provider conformance suite — every LLMProvider adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AnthropicAdapter', () => {
    it('returns a well-formed LLMResponse on the happy path', async () => {
      const { AnthropicAdapter } = await import('../anthropic.js');
      const AnthropicSdk = (await import('@anthropic-ai/sdk')).default as unknown as { __instances: { messages: { create: ReturnType<typeof vi.fn> } }[] };
      const adapter = new AnthropicAdapter('fake-key');
      const instance = AnthropicSdk.__instances.at(-1)!;
      instance.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'hi there' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const response = await adapter.complete(BASE_REQUEST, 'claude-x');
      expect(response.provider).toBe('anthropic');
      expect(response.content).toBe('hi there');
      expect(response.promptTokens).toBe(10);
      expect(response.completionTokens).toBe(5);
      expect(response.cached).toBe(false);
      expect(response.traceId).toBe('trace-conformance');
      expect(typeof response.costUsd).toBe('number');
    });

    it('maps a real Anthropic.RateLimitError to the gateway RateLimitError', async () => {
      const { AnthropicAdapter } = await import('../anthropic.js');
      const AnthropicSdk = (await import('@anthropic-ai/sdk')).default as unknown as {
        __instances: { messages: { create: ReturnType<typeof vi.fn> } }[];
        RateLimitError: new (...args: unknown[]) => Error;
      };
      const adapter = new AnthropicAdapter('fake-key');
      const instance = AnthropicSdk.__instances.at(-1)!;
      instance.messages.create.mockRejectedValue(
        new AnthropicSdk.RateLimitError(429, { message: 'rate limited' }, 'rate limited', {}),
      );

      await expect(adapter.complete(BASE_REQUEST, 'claude-x')).rejects.toThrow(RateLimitError);
    });

    it('maps a generic SDK failure to GatewayError tagged with the provider name', async () => {
      const { AnthropicAdapter } = await import('../anthropic.js');
      const AnthropicSdk = (await import('@anthropic-ai/sdk')).default as unknown as { __instances: { messages: { create: ReturnType<typeof vi.fn> } }[] };
      const adapter = new AnthropicAdapter('fake-key');
      const instance = AnthropicSdk.__instances.at(-1)!;
      instance.messages.create.mockRejectedValue(new Error('network blip'));

      await expect(adapter.complete(BASE_REQUEST, 'claude-x')).rejects.toMatchObject({
        constructor: GatewayError,
        provider: 'anthropic',
      });
    });

    it('streams real incremental chunks that concatenate to the final response content', async () => {
      const { AnthropicAdapter } = await import('../anthropic.js');
      const AnthropicSdk = (await import('@anthropic-ai/sdk')).default as unknown as { __instances: { messages: { stream: ReturnType<typeof vi.fn> } }[] };
      const adapter = new AnthropicAdapter('fake-key');
      const instance = AnthropicSdk.__instances.at(-1)!;
      const events = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hel' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } },
      ];
      instance.messages.stream.mockReturnValue({
        [Symbol.asyncIterator]: async function* () { for (const e of events) yield e; },
        finalMessage: async () => ({ content: [{ type: 'text', text: 'hello' }], usage: { input_tokens: 3, output_tokens: 2 } }),
      });

      const gen = adapter.completeStream!(BASE_REQUEST, 'claude-x');
      let chunks = '';
      let result = await gen.next();
      while (!result.done) { chunks += result.value; result = await gen.next(); }
      expect(chunks).toBe('hello');
      expect(result.value.content).toBe('hello');
      expect(result.value.provider).toBe('anthropic');
    });
  });

  describe('OpenAIAdapter', () => {
    it('returns a well-formed LLMResponse on the happy path', async () => {
      const { OpenAIAdapter } = await import('../openai.js');
      const OpenAISdk = (await import('openai')).default as unknown as { __instances: { chat: { completions: { create: ReturnType<typeof vi.fn> } } }[] };
      const adapter = new OpenAIAdapter('fake-key');
      const instance = OpenAISdk.__instances.at(-1)!;
      instance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'hi there' } }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      });

      const response = await adapter.complete(BASE_REQUEST, 'gpt-x');
      expect(response.provider).toBe('openai');
      expect(response.content).toBe('hi there');
      expect(response.promptTokens).toBe(8);
    });

    it('maps a real OpenAI.RateLimitError to the gateway RateLimitError', async () => {
      const { OpenAIAdapter } = await import('../openai.js');
      const OpenAISdk = (await import('openai')).default as unknown as {
        __instances: { chat: { completions: { create: ReturnType<typeof vi.fn> } } }[];
        RateLimitError: new (...args: unknown[]) => Error;
      };
      const adapter = new OpenAIAdapter('fake-key');
      const instance = OpenAISdk.__instances.at(-1)!;
      instance.chat.completions.create.mockRejectedValue(
        new OpenAISdk.RateLimitError(429, { message: 'rate limited' }, 'rate limited', {}),
      );

      await expect(adapter.complete(BASE_REQUEST, 'gpt-x')).rejects.toThrow(RateLimitError);
    });

    it('embed() returns real embedding vectors and cost', async () => {
      const { OpenAIAdapter } = await import('../openai.js');
      const OpenAISdk = (await import('openai')).default as unknown as { __instances: { embeddings: { create: ReturnType<typeof vi.fn> } }[] };
      const adapter = new OpenAIAdapter('fake-key');
      const instance = OpenAISdk.__instances.at(-1)!;
      instance.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { total_tokens: 5 },
      });

      const response = await adapter.embed!({ input: 'hello', traceId: 'trace-embed' }, 'embed-x');
      expect(response.embeddings).toEqual([[0.1, 0.2, 0.3]]);
      expect(response.provider).toBe('openai');
      expect(response.totalTokens).toBe(5);
    });
  });

  describe('OpenAICompatAdapter', () => {
    it('returns a well-formed LLMResponse tagged with the openai-compat provider name', async () => {
      const { OpenAICompatAdapter } = await import('../openai-compat.js');
      const OpenAISdk = (await import('openai')).default as unknown as { __instances: { chat: { completions: { create: ReturnType<typeof vi.fn> } } }[] };
      const adapter = new OpenAICompatAdapter('https://local-llm.example/v1');
      const instance = OpenAISdk.__instances.at(-1)!;
      instance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'local response' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      });

      const response = await adapter.complete(BASE_REQUEST, 'local-model');
      expect(response.provider).toBe('openai-compat');
      expect(response.content).toBe('local response');
    });
  });

  describe('GeminiAdapter', () => {
    it('returns a well-formed LLMResponse on the happy path', async () => {
      const { GeminiAdapter } = await import('../gemini.js');
      const GenAI = await import('@google/generative-ai') as unknown as {
        __instances: { model: { generateContent: ReturnType<typeof vi.fn> } }[];
      };
      const adapter = new GeminiAdapter('fake-key');
      const instance = GenAI.__instances.at(-1)!;
      instance.model.generateContent.mockResolvedValue({
        response: {
          text: () => 'hi there',
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6 },
        },
      });

      const response = await adapter.complete(BASE_REQUEST, 'gemini-x');
      expect(response.provider).toBe('gemini');
      expect(response.content).toBe('hi there');
      expect(response.promptTokens).toBe(12);
      expect(response.completionTokens).toBe(6);
    });

    it('maps a RESOURCE_EXHAUSTED error to the gateway RateLimitError', async () => {
      const { GeminiAdapter } = await import('../gemini.js');
      const GenAI = await import('@google/generative-ai') as unknown as {
        __instances: { model: { generateContent: ReturnType<typeof vi.fn> } }[];
      };
      const adapter = new GeminiAdapter('fake-key');
      const instance = GenAI.__instances.at(-1)!;
      instance.model.generateContent.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));

      await expect(adapter.complete(BASE_REQUEST, 'gemini-x')).rejects.toThrow(RateLimitError);
    });

    it('maps a generic failure to GatewayError tagged with the gemini provider name', async () => {
      const { GeminiAdapter } = await import('../gemini.js');
      const GenAI = await import('@google/generative-ai') as unknown as {
        __instances: { model: { generateContent: ReturnType<typeof vi.fn> } }[];
      };
      const adapter = new GeminiAdapter('fake-key');
      const instance = GenAI.__instances.at(-1)!;
      instance.model.generateContent.mockRejectedValue(new Error('network blip'));

      await expect(adapter.complete(BASE_REQUEST, 'gemini-x')).rejects.toMatchObject({
        constructor: GatewayError,
        provider: 'gemini',
      });
    });

    it('handles a multimodal request (image + text) without throwing', async () => {
      const { GeminiAdapter } = await import('../gemini.js');
      const GenAI = await import('@google/generative-ai') as unknown as {
        __instances: { model: { generateContent: ReturnType<typeof vi.fn> } }[];
      };
      const adapter = new GeminiAdapter('fake-key');
      const instance = GenAI.__instances.at(-1)!;
      instance.model.generateContent.mockResolvedValue({
        response: { text: () => 'saw the image', usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5 } },
      });

      const response = await adapter.complete(
        { ...BASE_REQUEST, images: [{ mimeType: 'image/jpeg', data: 'base64data' }] },
        'gemini-x',
      );
      expect(response.content).toBe('saw the image');
    });

    it('streams real incremental chunks that concatenate to the final response content', async () => {
      const { GeminiAdapter } = await import('../gemini.js');
      const GenAI = await import('@google/generative-ai') as unknown as {
        __instances: { model: { generateContentStream: ReturnType<typeof vi.fn> } }[];
      };
      const adapter = new GeminiAdapter('fake-key');
      const instance = GenAI.__instances.at(-1)!;
      instance.model.generateContentStream.mockResolvedValue({
        stream: (async function* () { yield { text: () => 'hel' }; yield { text: () => 'lo' }; })(),
        response: Promise.resolve({ text: () => 'hello', usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } }),
      });

      const gen = adapter.completeStream!(BASE_REQUEST, 'gemini-x');
      let chunks = '';
      let result = await gen.next();
      while (!result.done) { chunks += result.value; result = await gen.next(); }
      expect(chunks).toBe('hello');
      expect(result.value.provider).toBe('gemini');
    });

    it('embed() returns real embedding vectors', async () => {
      const { GeminiAdapter } = await import('../gemini.js');
      const GenAI = await import('@google/generative-ai') as unknown as {
        __instances: { model: { embedContent: ReturnType<typeof vi.fn> } }[];
      };
      const adapter = new GeminiAdapter('fake-key');
      const instance = GenAI.__instances.at(-1)!;
      instance.model.embedContent.mockResolvedValue({ embedding: { values: [0.4, 0.5] } });

      const response = await adapter.embed!({ input: 'hello', traceId: 'trace-embed' }, 'embed-x');
      expect(response.embeddings).toEqual([[0.4, 0.5]]);
      expect(response.provider).toBe('gemini');
    });
  });

  describe('cross-adapter contract', () => {
    it('every adapter reports isAvailable() === true once constructed with a key', async () => {
      const { AnthropicAdapter } = await import('../anthropic.js');
      const { OpenAIAdapter } = await import('../openai.js');
      const { GeminiAdapter } = await import('../gemini.js');
      const { OpenAICompatAdapter } = await import('../openai-compat.js');

      expect(new AnthropicAdapter('k').isAvailable()).toBe(true);
      expect(new OpenAIAdapter('k').isAvailable()).toBe(true);
      expect(new GeminiAdapter('k').isAvailable()).toBe(true);
      expect(new OpenAICompatAdapter('https://x').isAvailable()).toBe(true);
    });

    it('every adapter\'s `name` matches what buildRouter() registers it under', async () => {
      const { AnthropicAdapter } = await import('../anthropic.js');
      const { OpenAIAdapter } = await import('../openai.js');
      const { GeminiAdapter } = await import('../gemini.js');
      const { OpenAICompatAdapter } = await import('../openai-compat.js');

      expect(new AnthropicAdapter('k').name).toBe('anthropic');
      expect(new OpenAIAdapter('k').name).toBe('openai');
      expect(new GeminiAdapter('k').name).toBe('gemini');
      expect(new OpenAICompatAdapter('https://x').name).toBe('openai-compat');
    });
  });
});

import OpenAI from 'openai';
import type { LLMProvider } from '../provider.js';
import type { LLMRequest, LLMResponse, EmbeddingRequest, EmbeddingResponse } from '@nutrimind/shared';
import { computeCostUsd, computeEmbeddingCostUsd } from '../catalog.js';
import { RateLimitError, ContextLengthError, GatewayError } from '../errors.js';

export class OpenAIAdapter implements LLMProvider {
  readonly name = 'openai';
  protected readonly client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  isAvailable(): boolean {
    return true;
  }

  async complete(request: LLMRequest, model: string): Promise<LLMResponse> {
    const start = Date.now();

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const m of request.messages) {
      if (m.role === 'user' && request.images?.length) {
        messages.push({
          role: 'user',
          content: [
            ...request.images.map((img) => ({
              type: 'image_url' as const,
              image_url: { url: `data:${img.mimeType};base64,${img.data}` },
            })),
            { type: 'text' as const, text: m.content },
          ],
        });
      } else {
        messages.push({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        });
      }
    }

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      });

      const content = response.choices[0]?.message.content ?? '';
      const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
      const promptTokens = usage.prompt_tokens;
      const completionTokens = usage.completion_tokens;
      const modelKey = `openai/${model}`;

      return {
        content,
        provider: 'openai',
        model,
        promptTokens,
        completionTokens,
        costUsd: computeCostUsd(modelKey, promptTokens, completionTokens),
        latencyMs: Date.now() - start,
        cached: false,
        traceId: request.traceId,
      };
    } catch (err: unknown) {
      if (err instanceof OpenAI.RateLimitError) throw new RateLimitError('openai');
      if (err instanceof OpenAI.BadRequestError && String(err.message).includes('context_length')) {
        throw new ContextLengthError('openai');
      }
      throw new GatewayError(
        `OpenAI error: ${err instanceof Error ? err.message : String(err)}`,
        'OPENAI_ERROR',
        'openai',
        true,
        err,
      );
    }
  }

  /** Phase 13 — real token-level streaming via the OpenAI SDK's native `stream: true` +
   *  `stream_options.include_usage` (real usage accounting on the final chunk, not estimated). */
  async *completeStream(request: LLMRequest, model: string): AsyncGenerator<string, LLMResponse, void> {
    const start = Date.now();

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    for (const m of request.messages) {
      messages.push({ role: m.role as 'user' | 'assistant' | 'system', content: m.content });
    }

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        stream: true,
        stream_options: { include_usage: true },
      });

      let content = '';
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          content += delta;
          yield delta;
        }
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens;
          completionTokens = chunk.usage.completion_tokens;
        }
      }

      const modelKey = `openai/${model}`;
      return {
        content,
        provider: 'openai',
        model,
        promptTokens,
        completionTokens,
        costUsd: computeCostUsd(modelKey, promptTokens, completionTokens),
        latencyMs: Date.now() - start,
        cached: false,
        traceId: request.traceId,
      };
    } catch (err: unknown) {
      if (err instanceof OpenAI.RateLimitError) throw new RateLimitError('openai');
      throw new GatewayError(
        `OpenAI streaming error: ${err instanceof Error ? err.message : String(err)}`,
        'OPENAI_ERROR',
        'openai',
        true,
        err,
      );
    }
  }

  async embed(request: EmbeddingRequest, model: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    try {
      const response = await this.client.embeddings.create({ model, input: inputs });
      const totalTokens = response.usage?.total_tokens ?? 0;
      const modelKey = `openai/${model}`;

      return {
        embeddings: response.data.map((d) => d.embedding),
        model,
        provider: 'openai',
        totalTokens,
        costUsd: computeEmbeddingCostUsd(modelKey, totalTokens),
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      throw new GatewayError(
        `OpenAI embed error: ${err instanceof Error ? err.message : String(err)}`,
        'OPENAI_EMBED_ERROR',
        'openai',
        true,
        err,
      );
    }
  }
}

import OpenAI from 'openai';
import type { LLMProvider } from '../provider.js';
import type { LLMRequest, LLMResponse } from '@nutrimind/shared';
import { computeCostUsd } from '../catalog.js';
import { GatewayError } from '../errors.js';

export class OpenAICompatAdapter implements LLMProvider {
  readonly name = 'openai-compat';
  private readonly client: OpenAI;

  constructor(baseURL: string, apiKey = 'placeholder') {
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
      messages.push({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      });
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
      const modelKey = `openai-compat/${model}`;

      return {
        content,
        provider: 'openai-compat',
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        costUsd: computeCostUsd(modelKey, usage.prompt_tokens, usage.completion_tokens),
        latencyMs: Date.now() - start,
        cached: false,
        traceId: request.traceId,
      };
    } catch (err: unknown) {
      throw new GatewayError(
        `OpenAI-compat error: ${err instanceof Error ? err.message : String(err)}`,
        'OPENAI_COMPAT_ERROR',
        'openai-compat',
        true,
        err,
      );
    }
  }

  /** Phase 13 — real streaming, same mechanism as OpenAIAdapter (any OpenAI-API-compatible
   *  endpoint is expected to support `stream: true` the same way). */
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

      const modelKey = `openai-compat/${model}`;
      return {
        content,
        provider: 'openai-compat',
        model,
        promptTokens,
        completionTokens,
        costUsd: computeCostUsd(modelKey, promptTokens, completionTokens),
        latencyMs: Date.now() - start,
        cached: false,
        traceId: request.traceId,
      };
    } catch (err: unknown) {
      throw new GatewayError(
        `OpenAI-compat streaming error: ${err instanceof Error ? err.message : String(err)}`,
        'OPENAI_COMPAT_ERROR',
        'openai-compat',
        true,
        err,
      );
    }
  }
}

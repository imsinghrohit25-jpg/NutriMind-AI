import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from '../provider.js';
import type { LLMRequest, LLMResponse, EmbeddingRequest, EmbeddingResponse } from '@nutrimind/shared';
import { computeCostUsd } from '../catalog.js';
import { RateLimitError, ContextLengthError, GatewayError } from '../errors.js';

export class AnthropicAdapter implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  isAvailable(): boolean {
    return true;
  }

  async complete(request: LLMRequest, model: string): Promise<LLMResponse> {
    const start = Date.now();

    const messages: Anthropic.MessageParam[] = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'user' && request.images?.length) {
          return {
            role: 'user' as const,
            content: [
              ...request.images.map((img) => ({
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                  data: img.data,
                },
              })),
              { type: 'text' as const, text: m.content },
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt,
        messages,
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      const promptTokens = response.usage.input_tokens;
      const completionTokens = response.usage.output_tokens;
      const modelKey = `anthropic/${model}`;

      return {
        content,
        provider: 'anthropic',
        model,
        promptTokens,
        completionTokens,
        costUsd: computeCostUsd(modelKey, promptTokens, completionTokens),
        latencyMs: Date.now() - start,
        cached: false,
        traceId: request.traceId,
      };
    } catch (err: unknown) {
      if (err instanceof Anthropic.RateLimitError) throw new RateLimitError('anthropic');
      if (err instanceof Anthropic.BadRequestError && String(err.message).includes('too long')) {
        throw new ContextLengthError('anthropic');
      }
      throw new GatewayError(
        `Anthropic error: ${err instanceof Error ? err.message : String(err)}`,
        'ANTHROPIC_ERROR',
        'anthropic',
        true,
        err,
      );
    }
  }

  /** Phase 13 — real token-level streaming via the Anthropic SDK's native `.messages.stream()`
   *  (not a buffer-then-chunk simulation like copilot/streaming.ts's pre-Phase-13 approach). */
  async *completeStream(request: LLMRequest, model: string): AsyncGenerator<string, LLMResponse, void> {
    const start = Date.now();

    const messages: Anthropic.MessageParam[] = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'user' && request.images?.length) {
          return {
            role: 'user' as const,
            content: [
              ...request.images.map((img) => ({
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                  data: img.data,
                },
              })),
              { type: 'text' as const, text: m.content },
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });

    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }

      const final = await stream.finalMessage();
      const content = final.content[0]?.type === 'text' ? final.content[0].text : '';
      const promptTokens = final.usage.input_tokens;
      const completionTokens = final.usage.output_tokens;
      const modelKey = `anthropic/${model}`;

      return {
        content,
        provider: 'anthropic',
        model,
        promptTokens,
        completionTokens,
        costUsd: computeCostUsd(modelKey, promptTokens, completionTokens),
        latencyMs: Date.now() - start,
        cached: false,
        traceId: request.traceId,
      };
    } catch (err: unknown) {
      if (err instanceof Anthropic.RateLimitError) throw new RateLimitError('anthropic');
      throw new GatewayError(
        `Anthropic streaming error: ${err instanceof Error ? err.message : String(err)}`,
        'ANTHROPIC_ERROR',
        'anthropic',
        true,
        err,
      );
    }
  }
}

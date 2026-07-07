import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from '@google/generative-ai';
import type { LLMProvider } from '../provider.js';
import type { LLMRequest, LLMResponse, EmbeddingRequest, EmbeddingResponse } from '@nutrimind/shared';
import { computeCostUsd, computeEmbeddingCostUsd } from '../catalog.js';
import { GatewayError, RateLimitError } from '../errors.js';

export class GeminiAdapter implements LLMProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  isAvailable(): boolean {
    return true;
  }

  async complete(request: LLMRequest, model: string): Promise<LLMResponse> {
    const start = Date.now();

    try {
      const generativeModel = this.client.getGenerativeModel({
        model,
        systemInstruction: request.systemPrompt,
      });

      const contents: Content[] = request.messages.map((m) => {
        if (m.role === 'user' && request.images?.length) {
          const parts: Part[] = [
            ...request.images.map((img) => ({
              inlineData: { mimeType: img.mimeType, data: img.data },
            })),
            { text: m.content },
          ];
          return { role: 'user', parts };
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        };
      });

      const response = await generativeModel.generateContent({ contents });
      const result = response.response;
      const content = result.text();

      const usage = result.usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const completionTokens = usage?.candidatesTokenCount ?? 0;
      const modelKey = `gemini/${model}`;

      return {
        content,
        provider: 'gemini',
        model,
        promptTokens,
        completionTokens,
        costUsd: computeCostUsd(modelKey, promptTokens, completionTokens),
        latencyMs: Date.now() - start,
        cached: false,
        traceId: request.traceId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new RateLimitError('gemini');
      }
      throw new GatewayError(`Gemini error: ${msg}`, 'GEMINI_ERROR', 'gemini', true, err);
    }
  }

  async embed(request: EmbeddingRequest, model: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    try {
      const embeddingModel = this.client.getGenerativeModel({ model });
      const results = await Promise.all(
        inputs.map((text) => embeddingModel.embedContent(text)),
      );

      const embeddings = results.map((r) => r.embedding.values);
      const totalTokens = inputs.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
      const modelKey = `gemini/${model}`;

      return {
        embeddings,
        model,
        provider: 'gemini',
        totalTokens,
        costUsd: computeEmbeddingCostUsd(modelKey, totalTokens),
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      throw new GatewayError(
        `Gemini embed error: ${err instanceof Error ? err.message : String(err)}`,
        'GEMINI_EMBED_ERROR',
        'gemini',
        true,
        err,
      );
    }
  }
}

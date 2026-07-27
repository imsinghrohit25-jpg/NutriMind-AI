import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from '@google/generative-ai';
import type { LLMProvider } from '../provider.js';
import type { LLMRequest, LLMResponse, EmbeddingRequest, EmbeddingResponse } from '@nutrimind/shared';
import { computeCostUsd, computeEmbeddingCostUsd } from '../catalog.js';
import { GatewayError, RateLimitError } from '../errors.js';

/** Every pgvector column in this project is vector(1536) (migrations 0008 knowledge_vectors,
 *  0011 scan_history_embeddings, 0023 ai_memory) and existing rows were written with OpenAI
 *  text-embedding-3-small (1536-d). gemini-embedding-001 defaults to 3072 dimensions, which would
 *  fail every insert and be incomparable with any already-stored vector. It's a Matryoshka (MRL)
 *  model, so 1536 is an officially-supported truncation — we pin `outputDimensionality` to it to
 *  stay a drop-in replacement for OpenAI with zero schema or data migration. */
const EMBEDDING_DIMENSIONS = 1536;

/** L2-normalise a vector. Gemini pre-normalises only the full 3072-d output; any reduced
 *  dimensionality must be normalised client-side (Google's own guidance) before it's usable with
 *  cosine similarity, so we always do it here. */
function l2Normalize(v: number[]): number[] {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  const norm = Math.sqrt(sumSq);
  return norm > 0 ? v.map((x) => x / norm) : v;
}

export class GeminiAdapter implements LLMProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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

  /** Phase 13 — real token-level streaming via the Gemini SDK's native generateContentStream(). */
  async *completeStream(request: LLMRequest, model: string): AsyncGenerator<string, LLMResponse, void> {
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

      const result = await generativeModel.generateContentStream({ contents });
      let content = '';

      for await (const chunk of result.stream) {
        const delta = chunk.text();
        if (delta) {
          content += delta;
          yield delta;
        }
      }

      const final = await result.response;
      const usage = final.usageMetadata;
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
      throw new GatewayError(`Gemini streaming error: ${msg}`, 'GEMINI_ERROR', 'gemini', true, err);
    }
  }

  async embed(request: EmbeddingRequest, model: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    // The @google/generative-ai SDK (v0.21) doesn't expose `outputDimensionality` on
    // embedContent(), so embeddings go through the REST batch endpoint directly — the SDK client
    // is still used for complete()/completeStream(). This is what lets us pin 1536 dimensions
    // (see EMBEDDING_DIMENSIONS above) and stay schema-compatible.
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          requests: inputs.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        if (res.status === 429) throw new RateLimitError('gemini');
        throw new GatewayError(
          `Gemini embed HTTP ${res.status}: ${detail}`,
          'GEMINI_EMBED_ERROR',
          'gemini',
          true,
        );
      }

      const json = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
      const raw = json.embeddings ?? [];
      if (raw.length !== inputs.length) {
        throw new GatewayError(
          `Gemini embed returned ${raw.length} vectors for ${inputs.length} inputs`,
          'GEMINI_EMBED_ERROR',
          'gemini',
          true,
        );
      }
      const embeddings = raw.map((e) => l2Normalize(e.values ?? []));
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
      if (err instanceof RateLimitError || err instanceof GatewayError) throw err;
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

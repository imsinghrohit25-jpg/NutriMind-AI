import type { LLMRequest, LLMResponse, EmbeddingRequest, EmbeddingResponse } from '@nutrimind/shared';

export interface LLMProvider {
  readonly name: string;
  complete(request: LLMRequest, model: string): Promise<LLMResponse>;
  embed?(request: EmbeddingRequest, model: string): Promise<EmbeddingResponse>;
  isAvailable(): boolean;
}

export interface ModelTarget {
  provider: string;
  model: string;
}

export interface TierPolicy {
  primary: ModelTarget;
  fallbacks: ModelTarget[];
  maxRetries: number;
  timeoutMs: number;
}

export type RoutingConfig = Record<string, TierPolicy>;

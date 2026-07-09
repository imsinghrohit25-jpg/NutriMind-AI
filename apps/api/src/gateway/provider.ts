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
  /** Phase 12 (§13.3 model routing tiers) — the T1 "small/fast model" target for this task tier.
   *  Optional/additive: a tier without one simply never routes to T1 (falls through to T2/primary
   *  as it always has), so every routing.json written before Phase 12 is unaffected. */
  fast?: ModelTarget;
}

export type RoutingConfig = Record<string, TierPolicy>;

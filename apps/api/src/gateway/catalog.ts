export interface ModelSpec {
  provider: string;
  model: string;
  inputCostPer1KTokens: number;
  outputCostPer1KTokens: number;
  embeddingCostPer1KTokens?: number;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
}

export const MODEL_CATALOG: Record<string, ModelSpec> = {
  'anthropic/claude-haiku-4-5-20251001': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    inputCostPer1KTokens: 0.0008,
    outputCostPer1KTokens: 0.004,
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'anthropic/claude-sonnet-4-6': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    inputCostPer1KTokens: 0.003,
    outputCostPer1KTokens: 0.015,
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'openai/gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPer1KTokens: 0.00015,
    outputCostPer1KTokens: 0.0006,
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'openai/gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    inputCostPer1KTokens: 0.005,
    outputCostPer1KTokens: 0.015,
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'openai/text-embedding-3-small': {
    provider: 'openai',
    model: 'text-embedding-3-small',
    inputCostPer1KTokens: 0.00002,
    outputCostPer1KTokens: 0,
    embeddingCostPer1KTokens: 0.00002,
    contextWindow: 8_191,
    maxOutputTokens: 0,
    supportsVision: false,
    supportsEmbeddings: true,
  },
  // gemini-1.5-flash/pro and text-embedding-004 (the entries these replace) were retired by
  // Google — confirmed via a real ListModels call against a live key (404 "no longer available")
  // during the Gemini/Vision integration session. Renamed to the "-latest" aliases Google
  // recommends (verified reachable via a real generateContent/embedContent call against the same
  // key). Pricing below is freshly pulled from ai.google.dev/gemini-api/docs/pricing (per-1M-token
  // figures converted to per-1K); contextWindow/maxOutputTokens are carried forward from the
  // prior generation's values (not independently re-verified — Google's model-list page doesn't
  // publish them) and embeddingDimensions is empirically measured from a real API response.
  'gemini/gemini-flash-latest': {
    provider: 'gemini',
    model: 'gemini-flash-latest',
    inputCostPer1KTokens: 0.0015,
    outputCostPer1KTokens: 0.009,
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'gemini/gemini-pro-latest': {
    provider: 'gemini',
    model: 'gemini-pro-latest',
    inputCostPer1KTokens: 0.002,
    outputCostPer1KTokens: 0.012,
    contextWindow: 2_000_000,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'gemini/gemini-embedding-001': {
    provider: 'gemini',
    model: 'gemini-embedding-001',
    inputCostPer1KTokens: 0.00015,
    outputCostPer1KTokens: 0,
    embeddingCostPer1KTokens: 0.00015,
    contextWindow: 2_048,
    maxOutputTokens: 0,
    supportsVision: false,
    supportsEmbeddings: true,
  },
};

export function computeCostUsd(
  modelKey: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const spec = MODEL_CATALOG[modelKey];
  if (!spec) return 0;
  return (
    (promptTokens / 1000) * spec.inputCostPer1KTokens +
    (completionTokens / 1000) * spec.outputCostPer1KTokens
  );
}

export function computeEmbeddingCostUsd(modelKey: string, totalTokens: number): number {
  const spec = MODEL_CATALOG[modelKey];
  if (!spec?.embeddingCostPer1KTokens) return 0;
  return (totalTokens / 1000) * spec.embeddingCostPer1KTokens;
}

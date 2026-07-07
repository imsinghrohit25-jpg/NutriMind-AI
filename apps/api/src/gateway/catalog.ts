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
  'gemini/gemini-1.5-flash': {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    inputCostPer1KTokens: 0.000075,
    outputCostPer1KTokens: 0.0003,
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'gemini/gemini-1.5-pro': {
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    inputCostPer1KTokens: 0.00125,
    outputCostPer1KTokens: 0.005,
    contextWindow: 2_000_000,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsEmbeddings: false,
  },
  'gemini/text-embedding-004': {
    provider: 'gemini',
    model: 'text-embedding-004',
    inputCostPer1KTokens: 0.000025,
    outputCostPer1KTokens: 0,
    embeddingCostPer1KTokens: 0.000025,
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

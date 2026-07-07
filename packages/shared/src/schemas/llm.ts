import { z } from 'zod';

export const TaskTierSchema = z.enum([
  'parse_assist',
  'vision_analysis',
  'copilot_reasoning',
  'report_generation',
  'embeddings',
]);
export type TaskTier = z.infer<typeof TaskTierSchema>;

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1),
});
export type Message = z.infer<typeof MessageSchema>;

export const ImageInputSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  data: z.string().min(1),
});
export type ImageInput = z.infer<typeof ImageInputSchema>;

export const LLMRequestSchema = z.object({
  tier: TaskTierSchema,
  messages: z.array(MessageSchema).min(1),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  images: z.array(ImageInputSchema).optional(),
  traceId: z.string(),
  userId: z.string().uuid().optional(),
  idempotencyKey: z.string().optional(),
});
export type LLMRequest = z.infer<typeof LLMRequestSchema>;

export const LLMResponseSchema = z.object({
  content: z.string(),
  provider: z.string(),
  model: z.string(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  cached: z.boolean(),
  traceId: z.string(),
});
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

export const EmbeddingRequestSchema = z.object({
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  traceId: z.string(),
  userId: z.string().uuid().optional(),
});
export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;

export const EmbeddingResponseSchema = z.object({
  embeddings: z.array(z.array(z.number())),
  model: z.string(),
  provider: z.string(),
  totalTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
});
export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;

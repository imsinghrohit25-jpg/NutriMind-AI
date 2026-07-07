import postgres from 'postgres';
import type { LLMResponse, EmbeddingResponse, TaskTier } from '@nutrimind/shared';

export interface CostLogEntry {
  traceId: string;
  userId?: string;
  taskTier: TaskTier;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  cached: boolean;
  success: boolean;
  errorCode?: string;
}

export class CostLogger {
  constructor(private readonly sql: postgres.Sql) {}

  async log(entry: CostLogEntry): Promise<void> {
    try {
      await this.sql`
        INSERT INTO public.llm_call_log (
          trace_id, user_id, task_tier, provider, model,
          prompt_tokens, completion_tokens, total_tokens,
          cost_usd, latency_ms, cached, success, error_code,
          called_at
        ) VALUES (
          ${entry.traceId},
          ${entry.userId ?? null},
          ${entry.taskTier},
          ${entry.provider},
          ${entry.model},
          ${entry.promptTokens},
          ${entry.completionTokens},
          ${entry.totalTokens},
          ${entry.costUsd},
          ${entry.latencyMs},
          ${entry.cached},
          ${entry.success},
          ${entry.errorCode ?? null},
          NOW()
        )
      `;
    } catch (err) {
      console.error('[cost-log] Failed to write llm_call_log entry:', err);
    }
  }

  logFromLLMResponse(
    response: LLMResponse,
    tier: TaskTier,
    userId?: string,
    errorCode?: string,
  ): Promise<void> {
    return this.log({
      traceId: response.traceId,
      userId,
      taskTier: tier,
      provider: response.provider,
      model: response.model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.promptTokens + response.completionTokens,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
      cached: response.cached,
      success: !errorCode,
      errorCode,
    });
  }

  logFromEmbeddingResponse(
    response: EmbeddingResponse,
    tier: TaskTier,
    traceId: string,
    userId?: string,
  ): Promise<void> {
    return this.log({
      traceId,
      userId,
      taskTier: tier,
      provider: response.provider,
      model: response.model,
      promptTokens: response.totalTokens,
      completionTokens: 0,
      totalTokens: response.totalTokens,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
      cached: false,
      success: true,
    });
  }
}

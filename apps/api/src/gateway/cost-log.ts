import postgres from 'postgres';
import type { LLMResponse, EmbeddingResponse, TaskTier } from '@nutrimind/shared';

export type CallStatus = 'success' | 'error' | 'timeout' | 'policy_blocked';

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
  status: CallStatus;
  errorMessage?: string;
}

export class CostLogger {
  constructor(private readonly sql: postgres.Sql) {}

  // Column names match migration 0009 (`status`, `error_message`, `created_at`) + migration 0025
  // (`cached`) — the previous version of this INSERT targeted columns
  // (`success`, `error_code`, `called_at`) that never existed on this table and silently failed
  // on every real call (caught below); found while building Phase 12's cost-governance job,
  // which is the first real reader of this table.
  async log(entry: CostLogEntry): Promise<void> {
    try {
      await this.sql`
        INSERT INTO public.llm_call_log (
          trace_id, user_id, task_tier, provider, model,
          prompt_tokens, completion_tokens, total_tokens,
          cost_usd, latency_ms, cached, status, error_message,
          created_at
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
          ${entry.status},
          ${entry.errorMessage ?? null},
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
    status: CallStatus = 'success',
    errorMessage?: string,
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
      // A cache hit incurs no real provider spend — logging the original call's cost again here
      // would double (or N-times-over) count it against the daily cost budget (Phase 12, §13.3).
      costUsd: response.cached ? 0 : response.costUsd,
      latencyMs: response.latencyMs,
      cached: response.cached,
      status,
      errorMessage,
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
      status: 'success',
    });
  }
}

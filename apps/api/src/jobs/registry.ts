import type PgBoss from 'pg-boss';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { getBoss } from './boss.js';
import { env } from '../env.js';
import { runMemoryAggregationJob, findUsersWithRecentActivity, type MemoryAggregationJobData } from './handlers/memory-aggregation.js';
import { runWeeklyReportJob, findUsersDueForWeeklyReport, lastWeekStart, type WeeklyReportJobData } from './handlers/weekly-report.js';
import { processProductEmbedding } from '../embeddings/product-pipeline.js';
import { embedChunkById } from '../knowledge/ingest/embedder.js';
import { embedUserHistoryItem } from '../memory/history-item-embedder.js';
import { runFitbitSyncJob, type FitbitSyncJobData } from './handlers/fitbit-sync.js';
import { runGarminSyncJob, type GarminSyncJobData } from './handlers/garmin-sync.js';
import { findUsersWithHealthProviderToken } from './handlers/health-sync-fanout.js';
import { buildRouter, GatewayRouter } from '../gateway/router.js';
import { GatewayCache } from '../gateway/cache.js';
import { CostLogger } from '../gateway/cost-log.js';
import { runCostBudgetCheck } from '../gateway/cost-governance.js';

// worker.ts runs as a separate process from the Fastify app (no fastify.supabase decoration
// available here) — a lazily-created service-role client, matching plugins/supabase.ts's exact
// config, is the real equivalent for this process.
let supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}

// Same reasoning as getSupabaseAdmin() above, for the two jobs (embed-product,
// embed-user-history via the memory embeddings service) that call the LLM gateway's embeddings
// tier — app.ts builds an equivalent instance per Fastify request process; this worker process
// needs its own, built once and reused across job batches.
let sqlClient: ReturnType<typeof postgres> | null = null;
function getSqlClient(): ReturnType<typeof postgres> {
  if (!sqlClient) {
    sqlClient = postgres(env.DATABASE_URL, { max: 5, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  }
  return sqlClient;
}

let gatewayInstance: GatewayRouter | null = null;
function getGateway(): GatewayRouter | null {
  if (gatewayInstance) return gatewayInstance;
  const hasAnyKey =
    env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.GEMINI_API_KEY || env.OPENAI_COMPAT_BASE_URL;
  if (!hasAnyKey) return null;

  gatewayInstance = buildRouter({
    anthropicKey: env.ANTHROPIC_API_KEY,
    openaiKey: env.OPENAI_API_KEY,
    geminiKey: env.GEMINI_API_KEY,
    openaiCompatBaseUrl: env.OPENAI_COMPAT_BASE_URL,
    openaiCompatKey: env.OPENAI_COMPAT_API_KEY,
    routingConfigPath: env.LLM_ROUTING_CONFIG,
    costLogger: new CostLogger(getSqlClient()),
    cache: new GatewayCache(),
  });
  return gatewayInstance;
}

export type JobHandler<T> = (jobs: PgBoss.Job<T>[]) => Promise<void>;

export interface JobRegistration<T = unknown> {
  handler: JobHandler<T>;
  workerOptions?: PgBoss.WorkOptions;
}

const registry = new Map<string, JobRegistration>();

export function registerJob<T>(
  name: string,
  registration: JobRegistration<T>,
): void {
  registry.set(name, registration as JobRegistration<unknown>);
}

/** The only jobs safe to trigger this way: fanout/cron entry points that take no job.data and
 *  discover their own targets. Per-item jobs (weekly-report, embed-product, fitbit-sync, ...)
 *  need real per-item data from their fanout and must never be run-once'd directly. */
const CRON_TRIGGERABLE_JOBS = [
  'aggregate-memory-facts-fanout',
  'health-sync-fanout',
  'weekly-report-fanout',
  'ai-cost-budget-check',
] as const;

/**
 * Runs one registered fanout/cron job's handler a single time, synthesizing an empty job batch.
 * This is the real substitute for pg-boss's `boss.schedule()` cron when the trigger is a K8s
 * CronJob instead (Phase 12, §13.2/ADR-0025's follow-up): the CronJob's container command is
 * `node dist/jobs/run-once.js <job-name>`, which calls this and exits — the aggregation/sync/
 * report LOGIC is identical either way, only what fires it differs.
 */
export async function runJobOnce(name: string): Promise<void> {
  if (!(CRON_TRIGGERABLE_JOBS as readonly string[]).includes(name)) {
    throw new Error(`runJobOnce: "${name}" is not a cron-triggerable fanout job (must be one of ${CRON_TRIGGERABLE_JOBS.join(', ')})`);
  }
  const registration = registry.get(name);
  if (!registration) throw new Error(`runJobOnce: no job registered with name "${name}"`);
  await registration.handler([{ id: 'run-once', data: {} } as never]);
}

export async function startAllWorkers(): Promise<void> {
  const boss = await getBoss();

  for (const [name, { handler, workerOptions }] of registry.entries()) {
    await boss.work(name, { batchSize: 2, ...workerOptions }, handler);
    console.log(`[jobs] worker started: ${name}`);
  }
}

// Phase 12 (§13, job-stub wiring): weekly-report had a full real implementation
// (jobs/handlers/weekly-report.ts, runWeeklyReportJob) sitting unused behind this console.log
// stub since it was written. Wired here; fan-out + schedule added below.
registerJob<WeeklyReportJobData>('weekly-report', {
  handler: async (jobs) => {
    const supabase = getSupabaseAdmin();
    for (const job of jobs) {
      try {
        await runWeeklyReportJob(job.data, supabase as never);
      } catch (err) {
        console.error(`[jobs] weekly-report failed for user=${job.data.userId}:`, err instanceof Error ? err.message : err);
      }
    }
  },
  workerOptions: { batchSize: 1 },
});

// Phase 12: wired to processProductEmbedding (embeddings/product-pipeline.ts) — real logic,
// previously called by nothing (enqueueProductEmbedding had no reader either).
registerJob<{ productId: string }>('embed-product', {
  handler: async (jobs) => {
    const gateway = getGateway();
    if (!gateway) {
      console.warn('[jobs] embed-product: no LLM provider configured, skipping batch');
      return;
    }
    for (const job of jobs) {
      try {
        await processProductEmbedding(job.data.productId, { sql: getSqlClient(), gateway });
      } catch (err) {
        console.error(`[jobs] embed-product failed for product=${job.data.productId}:`, err instanceof Error ? err.message : err);
      }
    }
  },
});

// Phase 12: wired to embedChunkById (knowledge/ingest/embedder.ts) — re-embeds an
// already-ingested chunk by id (backfill/model-change path; fresh ingestion embeds inline).
registerJob<{ chunkId: string }>('embed-knowledge-chunk', {
  handler: async (jobs) => {
    const supabase = getSupabaseAdmin();
    const gateway = getGateway();
    if (!gateway) {
      console.warn('[jobs] embed-knowledge-chunk: no LLM provider configured, skipping batch');
      return;
    }
    for (const job of jobs) {
      const result = await embedChunkById(job.data.chunkId, supabase as never, gateway);
      if (!result.embedded) {
        console.warn(`[jobs] embed-knowledge-chunk: chunk=${job.data.chunkId} not embedded: ${result.error}`);
      }
    }
  },
});

// Phase 12: wired to embedUserHistoryItem (memory/history-item-embedder.ts) — resolves the
// source user_events row and upserts it into Layer 3 semantic memory (user_memory_embeddings).
registerJob<{ userId: string; sourceId: string; sourceType: string }>('embed-user-history', {
  handler: async (jobs) => {
    const supabase = getSupabaseAdmin();
    const gateway = getGateway();
    if (!gateway) {
      console.warn('[jobs] embed-user-history: no LLM provider configured, skipping batch');
      return;
    }
    for (const job of jobs) {
      const result = await embedUserHistoryItem(
        job.data.userId, job.data.sourceId, job.data.sourceType, supabase as never, gateway,
      );
      if (!result.embedded) {
        console.warn(`[jobs] embed-user-history: source=${job.data.sourceId} not embedded: ${result.reason}`);
      }
    }
  },
});

// Phase 12: fitbit-sync.ts/garmin-sync.ts (both real since Phase 13/§R) were never registered
// as pg-boss workers at all — not even reachable as stubs. Registered here; fan-out below.
registerJob<FitbitSyncJobData>('fitbit-sync', {
  handler: async (jobs) => {
    const supabase = getSupabaseAdmin();
    for (const job of jobs) {
      try {
        await runFitbitSyncJob(job.data, supabase as never);
      } catch (err) {
        console.error(`[jobs] fitbit-sync failed for user=${job.data.userId}:`, err instanceof Error ? err.message : err);
      }
    }
  },
});

registerJob<GarminSyncJobData>('garmin-sync', {
  handler: async (jobs) => {
    const supabase = getSupabaseAdmin();
    for (const job of jobs) {
      try {
        await runGarminSyncJob(job.data, supabase as never);
      } catch (err) {
        console.error(`[jobs] garmin-sync failed for user=${job.data.userId}:`, err instanceof Error ? err.message : err);
      }
    }
  },
});

registerJob<Record<string, never>>('health-sync-fanout', {
  handler: async () => {
    const boss = await getBoss();
    const supabase = getSupabaseAdmin();
    const [fitbitUsers, garminUsers] = await Promise.all([
      findUsersWithHealthProviderToken(supabase as never, 'fitbit'),
      findUsersWithHealthProviderToken(supabase as never, 'garmin'),
    ]);
    for (const userId of fitbitUsers) await boss.send('fitbit-sync', { userId } satisfies FitbitSyncJobData);
    for (const userId of garminUsers) await boss.send('garmin-sync', { userId } satisfies GarminSyncJobData);
    console.log(`[jobs] health-sync-fanout: enqueued fitbit=${fitbitUsers.length} garmin=${garminUsers.length}`);
  },
});

registerJob<Record<string, never>>('weekly-report-fanout', {
  handler: async () => {
    const boss = await getBoss();
    const supabase = getSupabaseAdmin();
    const weekStart = lastWeekStart();
    const candidates = await findUsersDueForWeeklyReport(supabase as never, weekStart);
    for (const { userId, memberName } of candidates) {
      await boss.send(
        'weekly-report',
        { userId, weekStart, memberName } satisfies WeeklyReportJobData,
        { singletonKey: `weekly-report:${userId}:${weekStart}` },
      );
    }
    console.log(`[jobs] weekly-report-fanout: enqueued ${candidates.length} report(s) for week ${weekStart}`);
  },
});

// AI Memory System — Layer 2 aggregation. Phase 11 (§12.2). Unlike the handlers above before
// this phase's wiring (pre-existing console.log stubs never wired to their real implementations
// in jobs/handlers/*.ts — found in Phase 11, fixed in Phase 12; see ADR-0025/ADR-0026), this one
// has called real aggregation logic and persisted facts since Phase 11.
registerJob<MemoryAggregationJobData>('aggregate-memory-facts', {
  handler: async (jobs) => {
    const supabase = getSupabaseAdmin();
    for (const job of jobs) {
      try {
        const { factsWritten } = await runMemoryAggregationJob(job.data, supabase as never);
        console.log(`[jobs] aggregate-memory-facts: user=${job.data.userId} factsWritten=${factsWritten}`);
      } catch (err) {
        console.error(`[jobs] aggregate-memory-facts failed for user=${job.data.userId}:`, err instanceof Error ? err.message : err);
      }
    }
  },
  workerOptions: { batchSize: 5 },
});

registerJob<Record<string, never>>('aggregate-memory-facts-fanout', {
  handler: async () => {
    const boss = await getBoss();
    const supabase = getSupabaseAdmin();
    const userIds = await findUsersWithRecentActivity(supabase as never, 24);
    for (const userId of userIds) {
      await boss.send('aggregate-memory-facts', { userId } satisfies MemoryAggregationJobData);
    }
    console.log(`[jobs] aggregate-memory-facts-fanout: enqueued ${userIds.length} user(s)`);
  },
});

// Phase 12 (§13.3 cost governance). Only runs a real check when LLM_MONTHLY_BUDGET_USD is set —
// that env var has existed since before this phase but had zero readers anywhere in the codebase
// until now; without it there is no configured budget to enforce, so the job honestly no-ops
// rather than guessing a number nobody set.
registerJob<Record<string, never>>('ai-cost-budget-check', {
  handler: async () => {
    if (!env.LLM_MONTHLY_BUDGET_USD) {
      console.log('[jobs] ai-cost-budget-check: LLM_MONTHLY_BUDGET_USD not set, skipping');
      return;
    }
    const dailyBudgetUsd = env.LLM_MONTHLY_BUDGET_USD / 30;
    const { summary, killSwitchNowActive } = await runCostBudgetCheck(
      getSqlClient(), getSupabaseAdmin() as never, dailyBudgetUsd,
    );
    console.log(
      `[jobs] ai-cost-budget-check: spend=$${summary.totalCostUsd}/${dailyBudgetUsd.toFixed(2)} ` +
      `cacheHitRate=${(summary.cacheHitRate * 100).toFixed(1)}% killSwitch=${killSwitchNowActive}`,
    );
  },
});

/** Recurring triggers — the real (pg-boss, not K8s CronJob) scheduling mechanism; see the
 *  ADR-0025/ADR-0026 notes on why pg-boss cron satisfies the addendum's scheduling requirement
 *  in this environment (no managed K8s cluster to run a real CronJob against). Idempotent
 *  (pg-boss upserts the schedule by job name) — safe to call on every worker startup. */
export async function scheduleRecurringJobs(): Promise<void> {
  const boss = await getBoss();
  await boss.schedule('aggregate-memory-facts-fanout', '0 */6 * * *', {});
  console.log('[jobs] scheduled: aggregate-memory-facts-fanout (every 6h)');

  // Health provider sync — every 6h, same cadence as memory aggregation (frequent enough that
  // wearable data stays reasonably fresh; infrequent enough to respect provider rate limits).
  await boss.schedule('health-sync-fanout', '0 */6 * * *', {});
  console.log('[jobs] scheduled: health-sync-fanout (every 6h)');

  // Weekly report — Monday 08:00 IST (02:30 UTC).
  await boss.schedule('weekly-report-fanout', '30 2 * * 1', {});
  console.log('[jobs] scheduled: weekly-report-fanout (Mondays 08:00 IST)');

  // Cost governance — hourly, so a runaway-spend day trips the kill switch within the hour,
  // not at the next day boundary.
  await boss.schedule('ai-cost-budget-check', '0 * * * *', {});
  console.log('[jobs] scheduled: ai-cost-budget-check (hourly)');
}

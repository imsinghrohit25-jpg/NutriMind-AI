import type PgBoss from 'pg-boss';
import { createClient } from '@supabase/supabase-js';
import { getBoss } from './boss.js';
import { env } from '../env.js';
import { runMemoryAggregationJob, findUsersWithRecentActivity, type MemoryAggregationJobData } from './handlers/memory-aggregation.js';

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

export async function startAllWorkers(): Promise<void> {
  const boss = await getBoss();

  for (const [name, { handler, workerOptions }] of registry.entries()) {
    await boss.work(name, { batchSize: 2, ...workerOptions }, handler);
    console.log(`[jobs] worker started: ${name}`);
  }
}

registerJob<{ userId: string; weekStart: string }>('weekly-report', {
  handler: async (jobs) => {
    for (const job of jobs) {
      console.log('[jobs] weekly-report:', job.data);
    }
  },
  workerOptions: { batchSize: 1 },
});

registerJob<{ productId: string }>('embed-product', {
  handler: async (jobs) => {
    for (const job of jobs) {
      console.log('[jobs] embed-product:', job.data.productId);
    }
  },
});

registerJob<{ chunkId: string }>('embed-knowledge-chunk', {
  handler: async (jobs) => {
    for (const job of jobs) {
      console.log('[jobs] embed-knowledge-chunk:', job.data.chunkId);
    }
  },
});

registerJob<{ userId: string; sourceId: string; sourceType: string }>('embed-user-history', {
  handler: async (jobs) => {
    for (const job of jobs) {
      console.log('[jobs] embed-user-history:', job.data);
    }
  },
});

// AI Memory System — Layer 2 aggregation. Phase 11 (§12.2). Unlike the four handlers above
// (pre-existing console.log stubs never wired to their real implementations in
// jobs/handlers/*.ts — a gap documented, not fixed, here; see ADR-0025), this one calls real
// aggregation logic and actually persists facts.
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

/** Recurring triggers — the real (pg-boss, not K8s CronJob) scheduling mechanism for Phase 11's
 *  aggregation job; see the ADR-0025 note in memory-aggregation.ts for why. Call once at worker
 *  startup (idempotent — pg-boss upserts the schedule by job name). */
export async function scheduleRecurringJobs(): Promise<void> {
  const boss = await getBoss();
  // Every 6 hours — frequent enough that facts stay reasonably fresh, infrequent enough not to
  // recompute the same trailing-180-day window needlessly for slow-moving facts.
  await boss.schedule('aggregate-memory-facts-fanout', '0 */6 * * *', {});
  console.log('[jobs] scheduled: aggregate-memory-facts-fanout (every 6h)');
}

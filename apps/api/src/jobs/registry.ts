import type PgBoss from 'pg-boss';
import { getBoss } from './boss.js';

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

// CLI entrypoint for K8s CronJob-triggered fanout jobs (Phase 12, §13.2). Usage:
//   node dist/jobs/run-once.js <job-name>
// Imports registry.ts for its side-effecting registerJob() calls (never calls startAllWorkers()
// or scheduleRecurringJobs() — this process runs one job and exits, it is not a long-running
// pg-boss consumer), then invokes runJobOnce() and exits with the handler's outcome.

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadEnv } from '../load-env.js';
import { runJobOnce } from './registry.js';

loadEnv(dirname(fileURLToPath(import.meta.url)));

const jobName = process.argv[2];
if (!jobName) {
  console.error('[run-once] usage: node dist/jobs/run-once.js <job-name>');
  process.exit(1);
}

try {
  await runJobOnce(jobName);
  console.log(`[run-once] ${jobName} completed`);
  process.exit(0);
} catch (err) {
  console.error(`[run-once] ${jobName} failed:`, err instanceof Error ? err.message : err);
  process.exit(1);
}

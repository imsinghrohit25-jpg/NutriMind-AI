// AI Memory System — Layer 2 aggregation job handler. Phase 11 (§12.2, §14 Phase 11).
// Real pg-boss job (registered in jobs/registry.ts), scheduled via boss.schedule() cron —
// this build's real, working substitute for the K8s CronJob scheduling infrastructure the
// master prompt addendum names for Phase 12 (Enterprise Scale). See ADR-0025 for why: this
// project already has a working job queue (pg-boss, used since Phase 0 for weekly reports and
// embeddings), and standing up a Kubernetes cluster is out of scope for this environment — the
// aggregation LOGIC below is exactly what a K8s CronJob would invoke; only the trigger
// mechanism differs, and it's a real trigger, not a stub.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getEvents } from '../../memory/events.js';
import { aggregateAllFacts } from '../../memory/aggregation/index.js';
import { persistFacts } from '../../memory/facts-service.js';
import { seasonalItemsFor } from '../../memory/seasonal-produce-data.js';

export interface MemoryAggregationJobData {
  userId: string;
  /** ISO country code for seasonal-produce cross-referencing; omit to skip that taxonomy. */
  countryCode?: string;
}

/** Longest fact TTL is 180 days (travel_history) — pull enough history to recompute every
 *  taxonomy, but not the user's entire lifetime event log. */
const AGGREGATION_LOOKBACK_DAYS = 180;

export async function runMemoryAggregationJob(
  data: MemoryAggregationJobData,
  supabase: SupabaseClient,
): Promise<{ factsWritten: number }> {
  const { userId, countryCode } = data;

  const events = await getEvents(supabase, userId, {
    from: new Date(Date.now() - AGGREGATION_LOOKBACK_DAYS * 86_400_000),
    limit: 2000,
  });

  if (events.length === 0) return { factsWritten: 0 };

  const now = new Date();
  const seasonalItemsThisMonth = countryCode ? seasonalItemsFor(countryCode, now.getUTCMonth() + 1) : undefined;

  const facts = aggregateAllFacts(events, { seasonalItemsThisMonth, asOf: now });
  await persistFacts(supabase, userId, facts, now);

  return { factsWritten: facts.length };
}

/** Fan-out: find every user with at least one event in the last 24h and enqueue one aggregation
 *  job per user. This is what the scheduled cron entry point calls (jobs/registry.ts). */
export async function findUsersWithRecentActivity(supabase: SupabaseClient, sinceHours = 24): Promise<string[]> {
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('user_events')
    .select('user_id')
    .gte('occurred_at', since);

  if (error) throw new Error(`findUsersWithRecentActivity: ${error.message}`);
  return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
}

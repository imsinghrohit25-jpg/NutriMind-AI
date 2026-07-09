// Cost governance — Phase 12 (§13.3). Daily budget check against the real llm_call_log data
// (now actually populated — see migration 0025 + cost-log.ts fixes) and the runaway-cost kill
// switch, implemented as a global feature_flags row rather than a bespoke table so it reuses the
// existing, already-audited flag read/write path (routes/v1/flags.ts) instead of inventing a
// second on/off mechanism.

import type { SupabaseClient } from '@supabase/supabase-js';
import postgres from 'postgres';

export const AI_KILL_SWITCH_FLAG_KEY = 'global.p12.ai_cost_kill_switch';

export interface DailyCostSummary {
  dateUtc: string;
  totalCostUsd: number;
  callCount: number;
  cachedCount: number;
  cacheHitRate: number;
  byCountry: Array<{ countryCode: string | null; costUsd: number }>;
}

/** Sums today's (UTC) llm_call_log spend. Uses the `postgres` client (not supabase-js) because
 *  this runs from the worker process's cost-budget job, same as cost-log.ts's writer. */
export async function computeDailyCostSummary(sql: postgres.Sql): Promise<DailyCostSummary> {
  const rows = await sql<{ cost_usd: string; cached: boolean; country_code: string | null }[]>`
    SELECT l.cost_usd, l.cached, up.detected_country AS country_code
    FROM public.llm_call_log l
    LEFT JOIN public.users_profiles up ON up.id = l.user_id
    WHERE l.created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
  `;

  let totalCostUsd = 0;
  let cachedCount = 0;
  const byCountryMap = new Map<string | null, number>();

  for (const row of rows) {
    const cost = Number(row.cost_usd);
    totalCostUsd += cost;
    if (row.cached) cachedCount++;
    byCountryMap.set(row.country_code, (byCountryMap.get(row.country_code) ?? 0) + cost);
  }

  return {
    dateUtc: new Date().toISOString().slice(0, 10),
    totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
    callCount: rows.length,
    cachedCount,
    cacheHitRate: rows.length > 0 ? cachedCount / rows.length : 0,
    byCountry: [...byCountryMap.entries()].map(([countryCode, costUsd]) => ({ countryCode, costUsd })),
  };
}

/** Reads the global kill-switch row. Global-only (country_code IS NULL) — this is an
 *  operational on/off toggle, not a gradual per-user rollout, so it doesn't need
 *  flags.ts's deterministic-bucket rollout logic. */
export async function isKillSwitchActive(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', AI_KILL_SWITCH_FLAG_KEY)
    .is('country_code', null)
    .maybeSingle();

  if (error) {
    console.error('[cost-governance] isKillSwitchActive query failed:', error.message);
    return false; // fail open on read error — never fail closed on a governance check we can't trust
  }
  return data?.enabled === true;
}

export async function setKillSwitch(supabase: SupabaseClient, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled: active })
    .eq('key', AI_KILL_SWITCH_FLAG_KEY)
    .is('country_code', null);

  if (error) throw new Error(`setKillSwitch: ${error.message}`);
}

/** The real budget-check job body (jobs/registry.ts's ai-cost-budget-check). Flips the kill
 *  switch on when over budget, and back off once spend is back under budget (so an
 *  operator-forced manual kill isn't silently what turns it off again — this only ever toggles
 *  based on the same signal it's watching). */
export async function runCostBudgetCheck(
  sql: postgres.Sql,
  supabase: SupabaseClient,
  dailyBudgetUsd: number,
): Promise<{ summary: DailyCostSummary; killSwitchNowActive: boolean }> {
  const summary = await computeDailyCostSummary(sql);
  const overBudget = summary.totalCostUsd >= dailyBudgetUsd;

  const currentlyActive = await isKillSwitchActive(supabase);
  if (overBudget !== currentlyActive) {
    await setKillSwitch(supabase, overBudget);
    console.log(`[cost-governance] kill switch ${overBudget ? 'ENGAGED' : 'released'} — spend $${summary.totalCostUsd} vs budget $${dailyBudgetUsd}`);
  }

  return { summary, killSwitchNowActive: overBudget };
}

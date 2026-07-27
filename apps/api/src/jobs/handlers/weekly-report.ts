// Weekly report job handler — processes a single user's weekly nutrition summary.
// Triggered by pg-boss cron (every Monday 08:00 IST) or on-demand for testing.
// Aggregates 7 days of meals → identifies top overages and shortfalls → sends push notification.

import type { SupabaseClient } from '@supabase/supabase-js';
import { renderWeeklyReport, RenderedReport } from './report-renderer.js';
import { sendPush } from '../../push/fcm.js';
import { aggregateDay, MealEntry, DailyNutritionTotal } from '../../engines/meals/aggregate.js';
import { analyseGaps, type DailyGapReport } from '../../engines/meals/gap-analysis.js';
import { mealLogRowToEntry, resolveUserDailyBudget } from '../../engines/meals/meal-log-mapping.js';

export interface WeeklyReportJobData {
  userId:     string;
  weekStart:  string;  // ISO date string (Monday)
  memberName: string;
}

export async function runWeeklyReportJob(
  data: WeeklyReportJobData,
  supabase: SupabaseClient,
): Promise<void> {
  const { userId, weekStart, memberName } = data;

  // 1-7. Fetch → aggregate → weekly average → budget → gap → render, via the shared pipeline that
  // GET /v1/meals/weekly also uses (computeWeeklyReport below). Null = nothing logged this week or
  // a profile too incomplete to compute a budget → skip the push, same as before.
  const result = await computeWeeklyReport(supabase, userId, weekStart, memberName);
  if (!result) {
    console.log(`[weekly-report] Nothing to report for ${userId} week ${weekStart} (no meals or incomplete profile)`);
    return;
  }
  const report = result.rendered;

  // 8. Fetch FCM token
  const { data: tokenRow } = await supabase
    .from('push_tokens')
    .select('fcm_token')
    .eq('user_id', userId)
    .single();

  if (tokenRow?.fcm_token) {
    await sendPush(tokenRow.fcm_token as string, {
      title:   report.notificationTitle,
      body:    report.notificationBody,
      data:    { type: 'weekly_report', weekStart, deepLink: '/reports/weekly' },
    });
  }

  console.log(`[weekly-report] Sent report for ${userId} week ${weekStart}`);
}

export interface WeeklyReportResult {
  weekStart: string;
  weekEnd: string;
  memberName: string;
  weeklyAvg: DailyNutritionTotal;
  gapReport: DailyGapReport;
  rendered: RenderedReport;
  daysLogged: number;
}

/**
 * The shared weekly-report compute pipeline: 7 days of `meal_logs` → per-day aggregate → weekly
 * average → gap analysis vs the user's budget → rendered report. Used by BOTH the pg-boss job
 * (which then pushes it) and `GET /v1/meals/weekly` (which returns it) — one implementation, no
 * duplication. Returns null when the user logged nothing in the week or has too incomplete a
 * profile to compute a budget.
 */
export async function computeWeeklyReport(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  memberName: string,
): Promise<WeeklyReportResult | null> {
  const weekEnd = addDays(weekStart, 7);
  const { data: mealRows, error } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', weekStart)
    .lt('logged_at', weekEnd)
    .order('logged_at', { ascending: true });
  if (error || !mealRows || mealRows.length === 0) return null;

  // meal_logs stores absolute serving nutrition; mealLogRowToEntry's servingG:100 makes
  // aggregateDay's scaling a no-op (values pass through) — the same convention every caller uses.
  const dayMap = new Map<string, MealEntry[]>();
  for (const row of mealRows) {
    const day = (row.logged_at as string).slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(mealLogRowToEntry(row as Record<string, unknown>));
  }

  const budget = await resolveUserDailyBudget(supabase, userId);
  if (!budget) return null;

  const dailyTotals: DailyNutritionTotal[] = [];
  for (const [day, entries] of dayMap) dailyTotals.push(aggregateDay(entries, day));
  const weeklyAvg = averageTotals(dailyTotals);
  const gapReport = analyseGaps(weeklyAvg, budget, memberName);
  const rendered = renderWeeklyReport(weekStart, memberName, weeklyAvg, gapReport);

  return { weekStart, weekEnd, memberName, weeklyAvg, gapReport, rendered, daysLogged: dayMap.size };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Most recent Monday on/before `now`, as an ISO date string (the week just completed). */
export function lastWeekStart(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday - 7); // previous Monday, not this week's
  return d.toISOString().slice(0, 10);
}

export interface WeeklyReportCandidate {
  userId:     string;
  memberName: string;
}

/** Fan-out target list: onboarded users who logged at least one meal in the completed week —
 *  mirrors findUsersWithRecentActivity's shape (memory-aggregation.ts) for the same reason: a
 *  report for a user with nothing logged is pure noise, not a fixable per-user error. */
export async function findUsersDueForWeeklyReport(
  supabase: SupabaseClient,
  weekStart: string,
): Promise<WeeklyReportCandidate[]> {
  const weekEnd = addDays(weekStart, 7);
  const { data: mealRows, error: mealErr } = await supabase
    .from('meal_logs')
    .select('user_id')
    .gte('logged_at', weekStart)
    .lt('logged_at', weekEnd);
  if (mealErr) throw new Error(`findUsersDueForWeeklyReport: ${mealErr.message}`);

  const userIds = [...new Set((mealRows ?? []).map((r: { user_id: string }) => r.user_id))];
  if (userIds.length === 0) return [];

  const { data: profileRows, error: profileErr } = await supabase
    .from('users_profiles')
    .select('id, display_name')
    .in('id', userIds)
    .eq('onboarding_complete', true);
  if (profileErr) throw new Error(`findUsersDueForWeeklyReport: ${profileErr.message}`);

  return (profileRows ?? []).map((r: { id: string; display_name: string }) => ({
    userId: r.id,
    memberName: r.display_name,
  }));
}

function averageTotals(totals: DailyNutritionTotal[]): DailyNutritionTotal {
  if (totals.length === 0) {
    return {
      date: '', entryCount: 0,
      energyKcal: 0, proteinG: 0, fatTotalG: 0, fatSaturatedG: 0,
      fatTransG: 0, carbohydratesG: 0, sugarsG: 0, sugarsAddedG: 0,
      sugarsAddedIsEstimated: false, dietaryFiberG: 0, sodiumMg: 0,
    };
  }
  const n = totals.length;
  const sum = (key: keyof DailyNutritionTotal) =>
    totals.reduce((acc, t) => acc + ((t[key] as number) || 0), 0);

  return {
    date:               'weekly-avg',
    entryCount:         Math.round(sum('entryCount') / n),
    energyKcal:         Math.round(sum('energyKcal') / n * 10) / 10,
    proteinG:            Math.round(sum('proteinG') / n * 10) / 10,
    fatTotalG:           Math.round(sum('fatTotalG') / n * 10) / 10,
    fatSaturatedG:       Math.round(sum('fatSaturatedG') / n * 10) / 10,
    fatTransG:           Math.round(sum('fatTransG') / n * 10) / 10,
    carbohydratesG:      Math.round(sum('carbohydratesG') / n * 10) / 10,
    sugarsG:             Math.round(sum('sugarsG') / n * 10) / 10,
    sugarsAddedG:        Math.round(sum('sugarsAddedG') / n * 10) / 10,
    sugarsAddedIsEstimated: false,
    dietaryFiberG:       Math.round(sum('dietaryFiberG') / n * 10) / 10,
    sodiumMg:            Math.round(sum('sodiumMg') / n),
  };
}

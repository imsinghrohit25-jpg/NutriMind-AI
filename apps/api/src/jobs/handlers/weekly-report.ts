// Weekly report job handler — processes a single user's weekly nutrition summary.
// Triggered by pg-boss cron (every Monday 08:00 IST) or on-demand for testing.
// Aggregates 7 days of meals → identifies top overages and shortfalls → sends push notification.

import type { SupabaseClient } from '@supabase/supabase-js';
import { renderWeeklyReport, RenderedReport } from './report-renderer.js';
import { sendPush } from '../../push/fcm.js';
import type { DailyBudget } from '../../engines/personalization/budgets.js';
import { aggregateDay, MealEntry, DailyNutritionTotal } from '../../engines/meals/aggregate.js';
import { analyseGaps } from '../../engines/meals/gap-analysis.js';

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

  // 1. Fetch 7 days of meal entries
  const weekEnd = addDays(weekStart, 7);
  const { data: mealRows, error } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', weekStart)
    .lt('logged_at', weekEnd)
    .order('logged_at', { ascending: true });

  if (error) {
    console.error(`[weekly-report] Failed to fetch meals for ${userId}:`, error.message);
    return;
  }

  if (!mealRows || mealRows.length === 0) {
    console.log(`[weekly-report] No meals logged for ${userId} in week ${weekStart}`);
    return;
  }

  // 2. Aggregate each day and compute daily budgets
  const dayMap = new Map<string, MealEntry[]>();
  for (const row of mealRows) {
    const day = (row.logged_at as string).slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(row as unknown as MealEntry);
  }

  // 3. Fetch user budget
  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('daily_budget')
    .eq('user_id', userId)
    .single();

  const budget = profileRow?.daily_budget as DailyBudget | undefined;
  if (!budget) {
    console.warn(`[weekly-report] No budget for ${userId}, skipping`);
    return;
  }

  // 4. Build daily totals and gap reports
  const dailyTotals: DailyNutritionTotal[] = [];
  for (const [day, entries] of dayMap) {
    dailyTotals.push(aggregateDay(entries, day));
  }

  // 5. Compute 7-day averages
  const weeklyAvg = averageTotals(dailyTotals);

  // 6. Gap analysis on weekly average
  const gapReport = analyseGaps(weeklyAvg, budget, memberName);

  // 7. Render report
  const report = renderWeeklyReport(weekStart, memberName, weeklyAvg, gapReport);

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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

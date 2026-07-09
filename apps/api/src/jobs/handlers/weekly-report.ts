// Weekly report job handler — processes a single user's weekly nutrition summary.
// Triggered by pg-boss cron (every Monday 08:00 IST) or on-demand for testing.
// Aggregates 7 days of meals → identifies top overages and shortfalls → sends push notification.

import type { SupabaseClient } from '@supabase/supabase-js';
import { renderWeeklyReport, RenderedReport } from './report-renderer.js';
import { sendPush } from '../../push/fcm.js';
import { computeDailyBudget } from '../../engines/personalization/budgets.js';
import { computeEnergyTarget, type UserProfile, type Sex, type ActivityLevel } from '../../engines/personalization/targets.js';
import { aggregateDay, MealEntry, DailyNutritionTotal } from '../../engines/meals/aggregate.js';
import { analyseGaps } from '../../engines/meals/gap-analysis.js';

// Wire-format maps, DB (users_profiles CHECK constraints, migration 0002) -> engine types.
// Not a bare cast: 'prefer_not_to_say' has no engine equivalent (falls back to the same
// conservative 'other' BMR formula already used for it), and the DB's 5-level activity scale
// is offset by one name from the engine's 5-level scale ('very_active' in the DB is the
// engine's 'active' tier; DB's top tier is 'extra_active', mapping to the engine's 'very_active')
// — the exact bug class documented in ADR-0024/ADR-0025 (CountryProfile, ai_personalization).
const DB_SEX_TO_ENGINE: Record<string, Sex> = {
  male: 'male',
  female: 'female',
  other: 'other',
  prefer_not_to_say: 'other',
};

const DB_ACTIVITY_TO_ENGINE: Record<string, ActivityLevel> = {
  sedentary: 'sedentary',
  lightly_active: 'light',
  moderately_active: 'moderate',
  very_active: 'active',
  extra_active: 'very_active',
};

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
  // meal_logs stores already-resolved absolute nutrition for the logged serving (see migration
  // 0006's "Serving nutrition (computed by engine)" comment) — not per-100g density. aggregateDay
  // scales by servingG/100, so servingG:100 makes that scaling a no-op and the absolute values
  // pass through unchanged, rather than duplicating aggregateDay's summation logic here.
  const dayMap = new Map<string, MealEntry[]>();
  for (const row of mealRows) {
    const day = (row.logged_at as string).slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push({
      mealId:      row.id as string,
      productName: row.food_name as string,
      servingG:    100,
      loggedAt:    row.logged_at as string,
      nutrition: {
        energyKcal:     row.energy_kcal as number | null,
        proteinG:       row.protein_g as number | null,
        fatTotalG:      row.fat_total_g as number | null,
        fatSaturatedG:  null,
        fatTransG:      null,
        carbohydratesG: row.carbohydrates_g as number | null,
        sugarsG:        row.sugars_g as number | null,
        sugarsAddedG:   null,
        dietaryFiberG:  row.dietary_fiber_g as number | null,
        sodiumMg:       row.sodium_mg as number | null,
      },
    });
  }

  // 3. Fetch user profile and compute this week's budget from it (users_profiles has no stored
  // budget column — TDEE/macros are engine outputs, derived fresh here, same as any other caller).
  const { data: profileRow } = await supabase
    .from('users_profiles')
    .select('weight_kg, height_cm, age_years, biological_sex, activity_level')
    .eq('id', userId)
    .single();

  if (
    !profileRow ||
    profileRow.weight_kg == null || profileRow.height_cm == null ||
    profileRow.age_years == null || !profileRow.biological_sex || !profileRow.activity_level
  ) {
    console.warn(`[weekly-report] Incomplete profile for ${userId}, skipping`);
    return;
  }

  const profile: UserProfile = {
    weightKg:      profileRow.weight_kg as number,
    heightCm:      profileRow.height_cm as number,
    ageYears:      profileRow.age_years as number,
    sex:           DB_SEX_TO_ENGINE[profileRow.biological_sex as string] ?? 'other',
    activityLevel: DB_ACTIVITY_TO_ENGINE[profileRow.activity_level as string] ?? 'sedentary',
  };
  const energy = computeEnergyTarget(profile);
  const budget = computeDailyBudget(profile, energy);

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

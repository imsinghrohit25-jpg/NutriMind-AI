// user.goals / user.profile — Phase 13 (§16.3). Read via the real `users_profiles` table
// (migration 0002), RLS-scoped by the service-role client + explicit userId filter — same
// pattern as every other tool in this registry, no new access path.

import type { ToolDefinition, ToolContext } from '../types.js';

export interface UserProfileOutput {
  displayName: string;
  ageYears: number | null;
  biologicalSex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  dietType: string | null;
  conditions: string[];
  allergens: string[];
  preferredLanguage: string;
  preferredCountry: string | null;
  // Advanced personalization fields (migration 0036) — all optional; a null/empty value means
  // "not provided", never "not applicable". See that migration's header for why `religion` is
  // deliberately not used to auto-exclude foods.
  medications: string[];
  budgetLevel: string | null;
  sleepHoursAvg: number | null;
  stressLevel: string | null;
  mealTimingPattern: string | null;
  religion: string | null;
  reproductiveStatus: string | null;
  athleteStatus: string | null;
  bodyFatPct: number | null;
  waistCircumferenceCm: number | null;
}

export interface UserGoalsOutput {
  goal: string | null;
  tdeeKcal: number | null;
  macroProteinG: number | null;
  macroFatG: number | null;
  macroCarbsG: number | null;
}

async function fetchProfileRow(ctx: ToolContext): Promise<Record<string, unknown>> {
  const { data, error } = await ctx.supabase
    .from('users_profiles')
    .select('*')
    .eq('id', ctx.userId)
    .single();
  if (error || !data) throw new Error(`user profile fetch failed: ${error?.message ?? 'not found'}`);
  return data as Record<string, unknown>;
}

export const userProfileTool: ToolDefinition<Record<string, never>, UserProfileOutput> = {
  name: 'user.profile',
  description: 'The requesting user\'s real profile (diet type, allergens, conditions, language, country) — never a guess or a default persona.',
  execute: async (_input, ctx) => {
    const row = await fetchProfileRow(ctx);
    return {
      displayName: row.display_name as string,
      ageYears: row.age_years as number | null,
      biologicalSex: row.biological_sex as string | null,
      heightCm: row.height_cm as number | null,
      weightKg: row.weight_kg as number | null,
      activityLevel: row.activity_level as string | null,
      dietType: row.diet_type as string | null,
      conditions: (row.conditions as string[] | null) ?? [],
      allergens: (row.allergens as string[] | null) ?? [],
      preferredLanguage: row.preferred_language as string,
      preferredCountry: row.preferred_country as string | null,
      medications: (row.medications as string[] | null) ?? [],
      budgetLevel: row.budget_level as string | null,
      sleepHoursAvg: row.sleep_hours_avg as number | null,
      stressLevel: row.stress_level as string | null,
      mealTimingPattern: row.meal_timing_pattern as string | null,
      religion: row.religion as string | null,
      reproductiveStatus: row.reproductive_status as string | null,
      athleteStatus: row.athlete_status as string | null,
      bodyFatPct: row.body_fat_pct as number | null,
      waistCircumferenceCm: row.waist_circumference_cm as number | null,
    };
  },
};

export const userGoalsTool: ToolDefinition<Record<string, never>, UserGoalsOutput> = {
  name: 'user.goals',
  description: 'The requesting user\'s real stored goal + engine-computed TDEE/macro targets — never invented.',
  execute: async (_input, ctx) => {
    const row = await fetchProfileRow(ctx);
    return {
      goal: row.goal as string | null,
      tdeeKcal: row.tdee_kcal as number | null,
      macroProteinG: row.macro_protein_g as number | null,
      macroFatG: row.macro_fat_g as number | null,
      macroCarbsG: row.macro_carbs_g as number | null,
    };
  },
};

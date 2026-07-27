// Shared meal-log ↔ engine mapping — the single source of truth for turning a raw `meal_logs`
// row (migration 0006) into an engine `MealEntry`, and for deriving a user's `DailyBudget` from
// their stored profile. Extracted so the `/v1/meals` routes and the weekly-report job both reuse
// exactly one implementation instead of duplicating the (bug-prone, see ADR-0024/0025) DB→engine
// enum mapping.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MealEntry } from './aggregate.js';
import type { DailyBudget } from '../personalization/budgets.js';
import { computeDailyBudget } from '../personalization/budgets.js';
import {
  computeEnergyTarget,
  type UserProfile,
  type Sex,
  type ActivityLevel,
} from '../personalization/targets.js';

// DB (users_profiles CHECK constraints, migration 0002) → engine types. 'prefer_not_to_say' has no
// engine equivalent (falls back to the conservative 'other' BMR formula); the DB's 5-level activity
// scale is offset by one name from the engine's ('very_active' in the DB is the engine's 'active';
// the DB's top 'extra_active' is the engine's 'very_active') — the exact bug class documented in
// ADR-0024/ADR-0025.
export const DB_SEX_TO_ENGINE: Record<string, Sex> = {
  male: 'male',
  female: 'female',
  other: 'other',
  prefer_not_to_say: 'other',
};

export const DB_ACTIVITY_TO_ENGINE: Record<string, ActivityLevel> = {
  sedentary: 'sedentary',
  lightly_active: 'light',
  moderately_active: 'moderate',
  very_active: 'active',
  extra_active: 'very_active',
};

/**
 * A raw `meal_logs` row → engine [MealEntry]. `meal_logs` stores already-resolved ABSOLUTE serving
 * nutrition (not per-100g density — see migration 0006's "Serving nutrition (computed by engine)"
 * comment), so `servingG: 100` makes [aggregateDay]'s `servingG/100` scaling a no-op and the
 * absolute values pass through unchanged, rather than re-implementing the summation here.
 */
export function mealLogRowToEntry(row: Record<string, unknown>): MealEntry {
  return {
    mealId: row.id as string,
    productName: row.food_name as string,
    servingG: 100,
    loggedAt: row.logged_at as string,
    nutrition: {
      energyKcal: row.energy_kcal as number | null,
      proteinG: row.protein_g as number | null,
      fatTotalG: row.fat_total_g as number | null,
      fatSaturatedG: null,
      fatTransG: null,
      carbohydratesG: row.carbohydrates_g as number | null,
      sugarsG: row.sugars_g as number | null,
      sugarsAddedG: null,
      dietaryFiberG: row.dietary_fiber_g as number | null,
      sodiumMg: row.sodium_mg as number | null,
    },
  };
}

/**
 * Fetches the user's profile and derives their [DailyBudget] (TDEE + macro targets), the same way
 * every other caller does — freshly from the engine, never a stored column. Returns null when the
 * profile is too incomplete to compute a budget (so callers can degrade gracefully).
 */
export async function resolveUserDailyBudget(
  supabase: SupabaseClient,
  userId: string,
): Promise<DailyBudget | null> {
  const { data: p } = await supabase
    .from('users_profiles')
    .select('weight_kg, height_cm, age_years, biological_sex, activity_level')
    .eq('id', userId)
    .maybeSingle();

  if (
    !p ||
    p.weight_kg == null ||
    p.height_cm == null ||
    p.age_years == null ||
    !p.biological_sex ||
    !p.activity_level
  ) {
    return null;
  }

  const profile: UserProfile = {
    weightKg: p.weight_kg as number,
    heightCm: p.height_cm as number,
    ageYears: p.age_years as number,
    sex: DB_SEX_TO_ENGINE[p.biological_sex as string] ?? 'other',
    activityLevel: DB_ACTIVITY_TO_ENGINE[p.activity_level as string] ?? 'sedentary',
  };
  const energy = computeEnergyTarget(profile);
  return computeDailyBudget(profile, energy);
}

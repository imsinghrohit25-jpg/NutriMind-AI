-- Migration 0036: Advanced personalization fields (AI Nutrition Intelligence upgrade, Phase 2)
-- Rollback: supabase/migrations/0036_advanced_personalization_fields_rollback.sql
--
-- Additive, nullable/defaulted columns only — no existing row, query, RLS policy, or constraint
-- touched. Every column is optional (mission requirement): existing users get NULL (or '{}' for
-- the array column, matching the existing allergens/conditions convention) and every consumer
-- (agents/tools/user.ts, agents/personalization-context.ts, engines/disease/rules/*) already
-- treats an absent value as "skip this personalization, don't guess" — same discipline as
-- migration 0035's date_of_birth/phone_number/primary_health_goal.
--
-- religion is deliberately NOT used to auto-exclude foods (e.g. assuming all Hindu users avoid
-- beef) — individual adherence varies too much for a population-level stereotype to be safe or
-- accurate; see agents/personalization-context.ts's own comment on this. It's stored so a user
-- who wants religious dietary guidance can say so explicitly via diet_type/allergens/notes, and
-- so this data exists if a future explicit "religious dietary preference" feature is built.

BEGIN;

ALTER TABLE public.users_profiles
  ADD COLUMN IF NOT EXISTS medications TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS budget_level TEXT NULL
    CHECK (budget_level IN ('budget', 'moderate', 'premium')),
  ADD COLUMN IF NOT EXISTS sleep_hours_avg NUMERIC(3,1) NULL
    CHECK (sleep_hours_avg BETWEEN 0 AND 24),
  ADD COLUMN IF NOT EXISTS stress_level TEXT NULL
    CHECK (stress_level IN ('low', 'moderate', 'high')),
  ADD COLUMN IF NOT EXISTS meal_timing_pattern TEXT NULL
    CHECK (meal_timing_pattern IN (
      'standard', 'intermittent_fasting_16_8', 'intermittent_fasting_18_6',
      'early_dinner', 'late_dinner', 'shift_work', 'other'
    )),
  ADD COLUMN IF NOT EXISTS religion TEXT NULL
    CHECK (religion IN (
      'hindu', 'muslim', 'christian', 'sikh', 'buddhist', 'jewish', 'jain',
      'other', 'prefer_not_to_say'
    )),
  ADD COLUMN IF NOT EXISTS reproductive_status TEXT NULL
    CHECK (reproductive_status IN ('none', 'pregnant', 'lactating')),
  ADD COLUMN IF NOT EXISTS athlete_status TEXT NULL
    CHECK (athlete_status IN (
      'none', 'recreational', 'competitive_endurance', 'competitive_strength', 'other'
    )),
  ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC(4,1) NULL
    CHECK (body_fat_pct BETWEEN 3 AND 60),
  ADD COLUMN IF NOT EXISTS waist_circumference_cm NUMERIC(5,1) NULL
    CHECK (waist_circumference_cm BETWEEN 30 AND 300);

COMMENT ON COLUMN public.users_profiles.medications IS
  'Free-text medication names the user has declared (e.g. "levothyroxine"). Used to sharpen '
  'drug-food interaction guidance (engines/disease/rules/thyroid.ts) — never used to diagnose '
  'or as a substitute for a real medication list held by a clinician.';
COMMENT ON COLUMN public.users_profiles.budget_level IS
  'Self-reported grocery budget tier. Used only to weight which curated meal suggestions surface '
  'first (agents/meal-suggestions.ts) — never affects nutrition math.';
COMMENT ON COLUMN public.users_profiles.sleep_hours_avg IS
  'Self-reported average nightly sleep hours. Informational personalization context only.';
COMMENT ON COLUMN public.users_profiles.stress_level IS
  'Self-reported stress level. Informational personalization context only.';
COMMENT ON COLUMN public.users_profiles.meal_timing_pattern IS
  'Self-reported eating pattern (e.g. intermittent fasting window). Informational personalization '
  'context only — does not currently filter which foods are suggested.';
COMMENT ON COLUMN public.users_profiles.religion IS
  'Self-reported, optional. Deliberately NOT used to auto-exclude foods (see migration header) — '
  'stored for a possible future explicit religious-dietary-preference feature only.';
COMMENT ON COLUMN public.users_profiles.reproductive_status IS
  'Structured pregnancy/lactation status, distinct from the free-form `conditions` array — '
  'read by engines/disease/rules/pregnancy.ts alongside (not instead of) a "pregnancy" entry in '
  '`conditions`, so either signal alone is enough to trigger pregnancy-safe guidance.';
COMMENT ON COLUMN public.users_profiles.athlete_status IS
  'Self-reported training status. Competitive tiers raise the protein target above the general-'
  'population ICMR-NIN default (engines/personalization/budgets.ts), per ISSN position-stand '
  'ranges for endurance/strength athletes.';
COMMENT ON COLUMN public.users_profiles.body_fat_pct IS
  'Self-reported or device-measured body fat percentage. Optional, more accurate than BMI alone '
  'for muscular or older individuals — used to refine (not replace) the BMI-based body '
  'composition note in AI responses when present.';
COMMENT ON COLUMN public.users_profiles.waist_circumference_cm IS
  'Optional. Checked against WHO cardiometabolic risk thresholds (>102cm men, >88cm women) '
  'alongside the heart-disease/obesity condition rules when a value is on file.';

COMMIT;

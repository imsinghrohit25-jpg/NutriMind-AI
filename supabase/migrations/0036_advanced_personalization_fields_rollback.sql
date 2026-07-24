-- Rollback: 0036_advanced_personalization_fields
BEGIN;

ALTER TABLE public.users_profiles
  DROP COLUMN IF EXISTS medications,
  DROP COLUMN IF EXISTS budget_level,
  DROP COLUMN IF EXISTS sleep_hours_avg,
  DROP COLUMN IF EXISTS stress_level,
  DROP COLUMN IF EXISTS meal_timing_pattern,
  DROP COLUMN IF EXISTS religion,
  DROP COLUMN IF EXISTS reproductive_status,
  DROP COLUMN IF EXISTS athlete_status,
  DROP COLUMN IF EXISTS body_fat_pct,
  DROP COLUMN IF EXISTS waist_circumference_cm;

COMMIT;

-- Migration 0035: Global profile fields for the production registration/onboarding rebuild
-- Rollback: supabase/migrations/0035_global_profile_fields_rollback.sql
--
-- Additive, nullable columns — no existing row/query/constraint touched. Registration now
-- collects date of birth and phone number (previously not modeled at all: profile setup only
-- ever wrote to local on-device storage, never to this table — see the same migration's sibling
-- commit for the onboarding rebuild that fixes that). primary_health_goal is deliberately a new,
-- separate column from the existing `goal` (lose/maintain/gain, used by the TDEE/macro engine) —
-- "Diabetes Management" etc. are not weight directions, conflating them would corrupt the
-- existing engine's input.

BEGIN;

ALTER TABLE public.users_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL,
  ADD COLUMN IF NOT EXISTS phone_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS primary_health_goal TEXT NULL
    CHECK (primary_health_goal IN (
      'weight_loss', 'muscle_gain', 'diabetes_management', 'general_health', 'heart_health', 'other'
    ));

COMMENT ON COLUMN public.users_profiles.date_of_birth IS
  'Collected at registration. Preferred over a raw age_years input for accuracy over time.';
COMMENT ON COLUMN public.users_profiles.phone_number IS
  'E.164 format (e.g. +14155552671), collected at registration. Contact info only — not used '
  'for phone-based auth (this app authenticates by email/password and OAuth only).';
COMMENT ON COLUMN public.users_profiles.primary_health_goal IS
  'User-facing onboarding goal — distinct from `goal` (lose/maintain/gain), which the TDEE/macro '
  'engine consumes directly and must stay a pure weight-direction value.';

COMMIT;

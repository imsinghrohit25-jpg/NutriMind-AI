-- Migration: 0018_country_preferences
-- Purpose: Add preferred_country to user_profiles for CountryProfile resolution Step 2.
-- Rollback: see 0018_country_preferences_rollback.sql

BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_country text NULL,
  ADD COLUMN IF NOT EXISTS detected_country  text NULL;

COMMENT ON COLUMN user_profiles.preferred_country IS
  'ISO 3166-1 alpha-2 explicit user override for country (Step 1/2 of resolution chain). '
  'NULL = use automatic detection.';

COMMENT ON COLUMN user_profiles.detected_country IS
  'Last country resolved by the 6-step resolution chain. Used as fallback in offline scenarios.';

-- No RLS policy change required: user_profiles already has RLS enabled.
-- Users can update their own preferred_country via existing RLS policy.

COMMIT;

-- Migration: 0018_country_preferences
-- Purpose: Add preferred_country to users_profiles for CountryProfile resolution Step 2.
-- Rollback: see 0018_country_preferences_rollback.sql
--
-- Fixed (Phase 9 route-registration audit, ADR-0022): originally targeted `user_profiles`,
-- a table that has never existed (the real table, migration 0002, is `users_profiles`) — this
-- migration would have failed outright (`relation "user_profiles" does not exist`) against any
-- real database. `preferred_country`/`detected_country` are not yet read by
-- `country/resolution-chain.ts` (Steps 1/2 are currently header-based only) — wiring them in is
-- separate future work, out of scope for this fix.

BEGIN;

ALTER TABLE public.users_profiles
  ADD COLUMN IF NOT EXISTS preferred_country text NULL,
  ADD COLUMN IF NOT EXISTS detected_country  text NULL;

COMMENT ON COLUMN public.users_profiles.preferred_country IS
  'ISO 3166-1 alpha-2 explicit user override for country (Step 1/2 of resolution chain). '
  'NULL = use automatic detection.';

COMMENT ON COLUMN public.users_profiles.detected_country IS
  'Last country resolved by the 6-step resolution chain. Used as fallback in offline scenarios.';

-- No RLS policy change required: users_profiles already has RLS enabled.
-- Users can update their own preferred_country via existing RLS policy.

COMMIT;

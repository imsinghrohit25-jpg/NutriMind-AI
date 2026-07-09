-- Migration 0025: llm_call_log cache-hit tracking (Phase 12, §13.3 cost governance)
-- Rollback: supabase/migrations/0025_llm_call_log_fixes_rollback.sql
--
-- Design notes:
--   apps/api/src/gateway/cost-log.ts's INSERT has, since it was written, targeted columns that
--   never existed on this table (`cached`, `success`, `error_code`, `called_at` — the real
--   columns from migration 0009 are `status`, `error_message`, `created_at`; there was no
--   `cached` column at all). Every real call silently failed and was swallowed by cost-log.ts's
--   own try/catch, so llm_call_log has been empty in any real deployment since it was created —
--   found while building Phase 12's cost-governance job, which reads this table for real for the
--   first time. cost-log.ts is fixed in the same commit to use the columns that actually exist;
--   `cached` is genuinely new (needed for the addendum's "cache hit >= 90%" gate) and additive.

ALTER TABLE public.llm_call_log
  ADD COLUMN IF NOT EXISTS cached BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.llm_call_log.cached IS
  'True when this call was served from GatewayCache/SemanticCache — no real provider spend occurred, so cost_usd is logged as 0 for these rows (a cache hit must never be double-charged against the daily cost budget). Enables the cache-hit-rate metric: count(cached)/count(*).';

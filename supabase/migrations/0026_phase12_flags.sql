-- Migration 0026: Phase 12 feature flags (Enterprise Scale & Reliability)
-- Rollback: supabase/migrations/0026_phase12_flags_rollback.sql
--
-- Unlike every prior phase's flags (all seeded via one edited INSERT block in 0017 — tolerable
-- pre-launch, no production data to preserve, per ADR-0018/0017's own rationale), this migration
-- is a plain additive INSERT into the existing table. Phase 12 (§13.4) is where expand-contract
-- becomes a mandatory, CI-enforced discipline going forward (see the destructive-DDL guard added
-- this same phase) — this migration follows that rule from its very first line rather than
-- editing 0017 again.

BEGIN;

INSERT INTO feature_flags (key, enabled, country_code, description) VALUES
  ('global.p12.ai_cost_kill_switch',   false, NULL, 'Runaway AI-cost kill switch — forces T2->T1 model routing globally when the daily budget is exceeded (Phase 12, §13.3)'),
  ('global.p12.ai_gateway_semantic_cache', false, NULL, 'Embedding-similarity response cache for cacheScope=global gateway requests (Phase 12, §13.3)'),
  ('global.p12.k8s_worker_migration',  false, NULL, 'K8s CronJob/Deployment topology for worker/gateway services is available (still pg-boss-triggered until a cluster exists) (Phase 12, §13.2)'),
  ('global.p12.degradation_ladder',    false, NULL, 'Explicit reliability degradation ladder (full -> cached/stale -> offline-first) is active on core paths (Phase 12, §13.5)')
ON CONFLICT (key, COALESCE(country_code, '')) DO NOTHING;

COMMIT;

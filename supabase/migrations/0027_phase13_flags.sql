-- Migration 0027: Phase 13 feature flag (Multi-Agent System)
-- Rollback: supabase/migrations/0027_phase13_flags_rollback.sql
--
-- Plain additive INSERT, same expand-contract discipline as 0026 (Phase 12, §13.4).

BEGIN;

INSERT INTO feature_flags (key, enabled, country_code, description) VALUES
  ('global.p13.multi_agent_system', false, NULL, 'LangGraph.js Supervisor + 9 specialist agent nodes behind /v1/agent/chat (Phase 13, §16-17)')
ON CONFLICT (key, COALESCE(country_code, '')) DO NOTHING;

COMMIT;

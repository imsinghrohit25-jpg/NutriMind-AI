-- Migration 0033: Gemini label-enrichment feature flag
-- Rollback: supabase/migrations/0033_gemini_label_enrichment_flag_rollback.sql
--
-- Plain additive INSERT, same expand-contract discipline as 0026/0027 (§13.4).

BEGIN;

INSERT INTO feature_flags (key, enabled, country_code, description) VALUES
  ('global.p14.gemini_label_enrichment', false, NULL, 'AI enrichment (food ID, ingredient interpretation, candidate allergen mentions, explanation) layered on top of the deterministic on-device-OCR label parse, via the existing AI Gateway (Gemini integration)')
ON CONFLICT (key, COALESCE(country_code, '')) DO NOTHING;

COMMIT;

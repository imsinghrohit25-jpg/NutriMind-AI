-- Migration 0034: Google Vision OCR feature flag
-- Rollback: supabase/migrations/0034_google_vision_ocr_flag_rollback.sql
--
-- Plain additive INSERT, same expand-contract discipline as 0026/0027/0033 (§13.4).

BEGIN;

INSERT INTO feature_flags (key, enabled, country_code, description) VALUES
  ('global.p14.google_vision_ocr', false, NULL, 'Real OCR text extraction via Google Cloud Vision for the cloud-OCR-fallback label path (unsupported on-device script), feeding the same deterministic parseLabelText() + optional Gemini enrichment used elsewhere (Gemini/Vision integration)')
ON CONFLICT (key, COALESCE(country_code, '')) DO NOTHING;

COMMIT;

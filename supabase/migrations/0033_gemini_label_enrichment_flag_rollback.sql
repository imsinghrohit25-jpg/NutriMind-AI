-- Rollback: 0033_gemini_label_enrichment_flag
BEGIN;

DELETE FROM public.feature_flags
WHERE key = 'global.p14.gemini_label_enrichment' AND country_code IS NULL;

COMMIT;

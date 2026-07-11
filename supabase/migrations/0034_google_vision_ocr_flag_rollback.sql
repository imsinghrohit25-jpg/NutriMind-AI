-- Rollback: 0034_google_vision_ocr_flag
BEGIN;

DELETE FROM public.feature_flags
WHERE key = 'global.p14.google_vision_ocr' AND country_code IS NULL;

COMMIT;

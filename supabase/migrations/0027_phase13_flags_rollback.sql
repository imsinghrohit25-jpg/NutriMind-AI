-- Rollback: 0027_phase13_flags
BEGIN;

DELETE FROM public.feature_flags
WHERE key = 'global.p13.multi_agent_system' AND country_code IS NULL;

COMMIT;

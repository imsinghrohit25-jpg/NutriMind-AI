-- Rollback: 0026_phase12_flags
BEGIN;

DELETE FROM public.feature_flags
WHERE key IN (
  'global.p12.ai_cost_kill_switch',
  'global.p12.ai_gateway_semantic_cache',
  'global.p12.k8s_worker_migration',
  'global.p12.degradation_ladder'
) AND country_code IS NULL;

COMMIT;

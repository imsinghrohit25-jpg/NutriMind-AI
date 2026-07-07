-- Rollback 0009: Remove ops tables
DROP TABLE IF EXISTS public.curation_queue CASCADE;
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.llm_call_log CASCADE;
DROP FUNCTION IF EXISTS public.handle_feature_flags_updated_at();
DROP FUNCTION IF EXISTS public.handle_curation_queue_updated_at();

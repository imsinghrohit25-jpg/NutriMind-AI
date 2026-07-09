-- Rollback: 0025_llm_call_log_fixes
BEGIN;

ALTER TABLE public.llm_call_log
  DROP COLUMN IF EXISTS cached;

COMMIT;

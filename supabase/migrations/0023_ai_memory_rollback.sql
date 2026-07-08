-- Rollback: 0023_ai_memory
-- Removes Phase 11 additions. Safe to run after 0023 fails mid-migration.

BEGIN;

DROP FUNCTION IF EXISTS public.match_user_memory(uuid, vector, text, int);
DROP TABLE IF EXISTS public.recommendation_feedback;
DROP TABLE IF EXISTS public.seasonal_produce;
DROP TABLE IF EXISTS public.user_memory_embeddings;
DROP TABLE IF EXISTS public.user_memory_facts;
DROP TABLE IF EXISTS public.user_events CASCADE; -- CASCADE drops the monthly partitions too
DROP FUNCTION IF EXISTS public.ensure_user_events_partition(date);

COMMIT;

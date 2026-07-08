-- Rollback: 0022_processing_restriction
-- Removes Phase 8 additions. Safe to run after 0022 fails mid-migration.

BEGIN;

DROP TABLE IF EXISTS public.processing_restrictions;

COMMIT;

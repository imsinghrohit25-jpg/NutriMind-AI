-- Rollback: 0019_unified_food_schema
-- Removes Phase 3 additions. Safe to run after 0019 fails mid-migration.

BEGIN;

DELETE FROM public.data_sources
WHERE id IN ('cofid_2021', 'efsa_2021', 'ciqual_2020', 'bls_3_02', 'fsanz_2019');

DROP INDEX IF EXISTS public.idx_products_country_codes;
DROP INDEX IF EXISTS public.idx_products_source_region;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS country_codes,
  DROP COLUMN IF EXISTS source_region;

COMMIT;

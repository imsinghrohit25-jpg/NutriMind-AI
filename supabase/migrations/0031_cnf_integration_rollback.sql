-- Rollback: 0031_cnf_integration
BEGIN;

DROP POLICY IF EXISTS "import_batches_service_write" ON public.import_batches;
DROP POLICY IF EXISTS "import_batches_read_all_authenticated" ON public.import_batches;
DROP TABLE IF EXISTS public.import_batches;

DROP POLICY IF EXISTS "product_aliases_service_write" ON public.product_aliases;
DROP POLICY IF EXISTS "product_aliases_read_all_authenticated" ON public.product_aliases;
DROP TABLE IF EXISTS public.product_aliases;

DROP POLICY IF EXISTS "product_portions_service_write" ON public.product_portions;
DROP POLICY IF EXISTS "product_portions_read_all_authenticated" ON public.product_portions;
DROP TABLE IF EXISTS public.product_portions;

DELETE FROM public.data_sources WHERE id = 'cnf_2026';

COMMIT;

-- Rollback: 0024_seasonal_produce_seed
BEGIN;

DELETE FROM public.seasonal_produce
WHERE country_code IN ('IN', 'US', 'GB', 'AE', 'AU', 'CA', 'DE');

COMMIT;

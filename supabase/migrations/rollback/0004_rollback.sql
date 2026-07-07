-- Rollback 0004: Remove scanning tables
DROP TABLE IF EXISTS public.scan_images CASCADE;
DROP TABLE IF EXISTS public.scans CASCADE;

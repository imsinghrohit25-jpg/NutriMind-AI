-- Rollback: 0028_storage_buckets
BEGIN;

DROP POLICY IF EXISTS "knowledge_documents_select_authenticated" ON storage.objects;

DROP POLICY IF EXISTS "lab_reports_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "lab_reports_update_own" ON storage.objects;
DROP POLICY IF EXISTS "lab_reports_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "lab_reports_select_own" ON storage.objects;

DROP POLICY IF EXISTS "scan_images_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "scan_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "scan_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "scan_images_select_own" ON storage.objects;

-- Buckets are left in place deliberately: dropping a bucket that already contains objects fails
-- unless objects are deleted first, and this rollback should never silently destroy uploaded user
-- data. Remove buckets manually (via the dashboard or `storage.empty_bucket()` + `DELETE FROM
-- storage.buckets`) only after confirming they're empty.

COMMIT;

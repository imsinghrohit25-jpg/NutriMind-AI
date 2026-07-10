-- Migration 0028: Supabase Storage buckets & policies
-- Rollback: supabase/migrations/0028_storage_buckets_rollback.sql
--
-- Closes a real, evidenced gap: three tables were designed to reference Supabase Storage
-- (scan_images.storage_path since migration 0004, lab_reports.file_path since migration 0013,
-- knowledge_documents.file_path since migration 0008 — see each table's own migration comments)
-- but no migration ever created the buckets or their access policies, and no application code
-- has ever called supabase.storage anywhere in this codebase. storage.objects already has RLS
-- enabled by Supabase itself, so this migration only creates buckets and adds policies — it does
-- not re-enable RLS on storage.objects.
--
-- Path convention assumed (not yet enforced by any application code, since none writes to
-- Storage yet): every object's first path segment is the owning user's auth.uid(), e.g.
--   scan-images/{user_id}/{scan_id}/{image_type}.jpg
--   lab-reports/{user_id}/{lab_report_id}.pdf
-- This is the standard Supabase per-user Storage RLS pattern (storage.foldername(name)[1]).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. scan-images — barcode/label/meal photos (scan_images.storage_path, migration 0004)
--    Private, per-user. Users may read/write/delete only objects under their own user_id folder.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scan-images', 'scan-images', false,
  10485760, -- 10 MiB — client already compresses (scan_images.compressed_size_bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "scan_images_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "scan_images_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "scan_images_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "scan_images_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. lab-reports — uploaded lab report PDFs/images (lab_reports.file_path, migration 0013)
--    Private, per-user. Sensitive health data — no public read under any circumstance.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-reports', 'lab-reports', false,
  20971520, -- 20 MiB — multi-page scanned PDFs
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "lab_reports_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "lab_reports_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "lab_reports_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "lab_reports_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lab-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. knowledge-documents — ingested regulatory corpus (knowledge_documents.file_path, migration 0008)
--    Admin/ingestion-managed, NOT per-user. Readable by any authenticated user (Copilot citations
--    may link back to the real source document); writes are service_role-only — no INSERT/UPDATE/
--    DELETE policy is created for authenticated/anon, so RLS denies those roles by default.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-documents', 'knowledge-documents', false,
  52428800, -- 50 MiB — full regulatory PDFs (WHO/ICMR-NIN/FSSAI/EFSA/JECFA)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "knowledge_documents_select_authenticated"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'knowledge-documents' AND auth.role() = 'authenticated');

COMMIT;

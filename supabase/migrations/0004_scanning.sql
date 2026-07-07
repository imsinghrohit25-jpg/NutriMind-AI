-- Migration 0004: Scanning — scans, scan_images
-- Rollback: supabase/migrations/rollback/0004_rollback.sql
-- Validate: supabase/migrations/validate/0004_validate.sql
--
-- Design notes:
--   scans captures both real-time and offline-queued events (D6 offline-first).
--   scan_images links compressed images to Supabase Storage paths.
--   resolution_method is set by the waterfall resolver (Phase 3), not by LLM.

-- ---------------------------------------------------------------------------
-- scans
-- ---------------------------------------------------------------------------
CREATE TABLE public.scans (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id          UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  scan_type           TEXT        NOT NULL CHECK (scan_type IN ('barcode','label_ocr','meal_photo','manual')),
  raw_barcode         TEXT,
  ocr_raw_text        TEXT,
  -- parse_confidence: 0–1; low value triggers confirm-UI in M1 (Phase 5)
  parse_confidence    NUMERIC(4,3) CHECK (parse_confidence BETWEEN 0 AND 1),
  -- resolution_method set by Phase 3 waterfall; never LLM
  resolution_method   TEXT        CHECK (resolution_method IN ('cache','openfoodfacts','usda','ifct','manual','unresolved')),
  resolution_latency_ms INTEGER   CHECK (resolution_latency_ms >= 0),
  -- Offline-first (D6): scans queue locally and sync when connected
  is_offline          BOOLEAN     NOT NULL DEFAULT false,
  synced_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scans_user_created_idx ON public.scans(user_id, created_at DESC);
CREATE INDEX scans_product_idx      ON public.scans(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX scans_offline_idx      ON public.scans(user_id, synced_at) WHERE is_offline = true AND synced_at IS NULL;

-- ---------------------------------------------------------------------------
-- scan_images  (compressed; stored in Supabase Storage)
-- ---------------------------------------------------------------------------
CREATE TABLE public.scan_images (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id               UUID        NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  image_type            TEXT        NOT NULL CHECK (image_type IN ('barcode','label_front','label_nutrition','label_ingredients','meal')),
  -- storage_path: relative path within the Supabase Storage bucket
  storage_path          TEXT        NOT NULL,
  original_size_bytes   INTEGER     CHECK (original_size_bytes > 0),
  compressed_size_bytes INTEGER     CHECK (compressed_size_bytes > 0),
  width_px              SMALLINT    CHECK (width_px > 0),
  height_px             SMALLINT    CHECK (height_px > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scan_images_scan_idx ON public.scan_images(scan_id);

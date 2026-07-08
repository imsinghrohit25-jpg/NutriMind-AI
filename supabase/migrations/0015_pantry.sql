-- Phase 18: Pantry Intelligence
-- Tables: pantry_items, pantry_receipts

-- ── Pantry items ──────────────────────────────────────────────────────────────
CREATE TABLE pantry_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  quantity        numeric NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'units',
  category        text,
  expiry_date     date,
  purchase_date   date,
  estimated_rs    numeric,
  is_consumed     boolean NOT NULL DEFAULT false,
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','receipt_ocr','barcode')),
  barcode         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Receipt OCR records ───────────────────────────────────────────────────────
CREATE TABLE pantry_receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text    text NOT NULL,
  store_name  text,
  bill_date   date,
  total_rs    numeric,
  items_count integer,
  status      text NOT NULL DEFAULT 'processed' CHECK (status IN ('processing','processed','error')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pantry_user_expiry ON pantry_items (user_id, expiry_date) WHERE NOT is_consumed;
CREATE INDEX idx_pantry_receipts_user ON pantry_receipts (user_id, created_at DESC);

-- RLS
ALTER TABLE pantry_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_pantry_items"
  ON pantry_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_pantry_receipts"
  ON pantry_receipts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

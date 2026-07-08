-- Phase 14: Biomarker Platform — lab reports + CGM-ready glucose visualization
-- Tables: biomarker_types, lab_reports, lab_results, glucose_readings
-- Dexcom connector: oauth_tokens provider='dexcom' (reuses Phase 13 oauth_tokens)

-- ────────────────────────────────────────────────
-- Biomarker type registry
-- ────────────────────────────────────────────────
CREATE TABLE biomarker_types (
  id          text PRIMARY KEY,    -- e.g. 'hba1c', 'fasting_glucose', 'ldl_cholesterol'
  display_name text NOT NULL,
  unit        text NOT NULL,
  normal_min  numeric,
  normal_max  numeric,
  panel       text,               -- 'lipid', 'thyroid', 'diabetes', 'cbc', 'kidney'
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed standard Indian lab panel biomarkers
INSERT INTO biomarker_types (id, display_name, unit, normal_min, normal_max, panel) VALUES
  -- Diabetes markers
  ('fasting_glucose',   'Fasting Blood Glucose',  'mg/dL',   70,   99,  'diabetes'),
  ('postprandial_glucose','Post-Prandial Glucose', 'mg/dL',   null, 139, 'diabetes'),
  ('hba1c',             'HbA1c',                  '%',       null, 5.6, 'diabetes'),
  ('insulin_fasting',   'Fasting Insulin',        'μU/mL',   2.0,  25,  'diabetes'),
  -- Lipid panel
  ('total_cholesterol', 'Total Cholesterol',      'mg/dL',   null, 199, 'lipid'),
  ('ldl_cholesterol',   'LDL Cholesterol',        'mg/dL',   null, 99,  'lipid'),
  ('hdl_cholesterol',   'HDL Cholesterol',        'mg/dL',   40,   null,'lipid'),
  ('triglycerides',     'Triglycerides',          'mg/dL',   null, 149, 'lipid'),
  ('vldl_cholesterol',  'VLDL Cholesterol',       'mg/dL',   null, 29,  'lipid'),
  -- Thyroid
  ('tsh',               'TSH',                   'mIU/L',  0.4,  4.5, 'thyroid'),
  ('free_t3',           'Free T3',               'pg/mL',  2.3,  4.2, 'thyroid'),
  ('free_t4',           'Free T4',               'ng/dL',  0.8,  1.8, 'thyroid'),
  -- Kidney
  ('creatinine',        'Creatinine',            'mg/dL',  0.6,  1.2, 'kidney'),
  ('urea',              'Blood Urea',            'mg/dL',   7,    20,  'kidney'),
  ('uric_acid',         'Uric Acid',             'mg/dL',  2.4,  7.0, 'kidney'),
  ('egfr',              'eGFR',                  'mL/min',  60, null,  'kidney'),
  -- CBC essentials
  ('hemoglobin',        'Hemoglobin',            'g/dL',  12.0, 17.5, 'cbc'),
  ('hematocrit',        'Hematocrit',            '%',     36.0, 52.0, 'cbc'),
  ('wbc',               'WBC Count',             'K/μL',   4.0,  11.0,'cbc'),
  -- Vitamins / minerals (Indian prevalence)
  ('vitamin_d',         'Vitamin D (25-OH)',     'ng/mL',  30,  100,  'vitamins'),
  ('vitamin_b12',       'Vitamin B12',           'pg/mL', 200, 900,  'vitamins'),
  ('ferritin',          'Ferritin',              'ng/mL',  12,  300,  'vitamins'),
  ('iron',              'Serum Iron',            'μg/dL',  60,  170,  'vitamins'),
  -- Liver function
  ('alt',               'ALT (SGPT)',            'U/L',   null,  40,  'liver'),
  ('ast',               'AST (SGOT)',            'U/L',   null,  40,  'liver'),
  ('alkaline_phosphatase','Alkaline Phosphatase','U/L',    44,  147,  'liver'),
  -- Inflammation
  ('crp',               'CRP (high-sensitivity)','mg/L',  null,  1.0, 'inflammation'),
  ('esr',               'ESR',                  'mm/hr', null,  20,  'inflammation')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────
-- Lab report uploads (PDF / image)
-- ────────────────────────────────────────────────
CREATE TABLE lab_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date  date NOT NULL,
  lab_name     text,
  file_path    text,            -- Supabase Storage path; null if manual entry
  ocr_raw      text,            -- raw OCR text (for re-parsing)
  parse_status text NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending','processing','done','failed')),
  parse_error  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────
-- Individual lab result values
-- ────────────────────────────────────────────────
CREATE TABLE lab_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_report_id   uuid REFERENCES lab_reports(id) ON DELETE CASCADE,
  biomarker_type  text NOT NULL REFERENCES biomarker_types(id),
  value           numeric NOT NULL,
  unit            text NOT NULL,
  measured_at     timestamptz NOT NULL,  -- report date + midnight UTC
  source          text NOT NULL DEFAULT 'lab_upload' CHECK (source IN ('lab_upload', 'manual', 'dexcom', 'health_connect')),
  flags           text[],                -- e.g. {'high','critical'} from lab report
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, biomarker_type, measured_at, source)
);

-- ────────────────────────────────────────────────
-- CGM glucose readings (Dexcom G-series, Libre)
-- High-frequency: every 5 minutes
-- ────────────────────────────────────────────────
CREATE TABLE glucose_readings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value_mgdl      numeric NOT NULL,
  trend_arrow     text CHECK (trend_arrow IN ('rising_quickly','rising','stable','falling','falling_quickly','unknown')),
  reading_time    timestamptz NOT NULL,
  source_platform text NOT NULL DEFAULT 'dexcom' CHECK (source_platform IN ('dexcom', 'libre', 'manual')),
  external_id     text NOT NULL,          -- Dexcom EGV record ID or Libre reading UUID
  transmitter_id  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);

-- Indexes for time-series queries
CREATE INDEX idx_glucose_readings_user_time ON glucose_readings (user_id, reading_time DESC);
CREATE INDEX idx_lab_results_user_type_time ON lab_results (user_id, biomarker_type, measured_at DESC);
CREATE INDEX idx_lab_reports_user_date ON lab_reports (user_id, report_date DESC);

-- ────────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────────
ALTER TABLE lab_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE glucose_readings ENABLE ROW LEVEL SECURITY;

-- Users own their data; service role (backend workers) bypasses RLS
CREATE POLICY "users_own_lab_reports"
  ON lab_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_lab_results"
  ON lab_results FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_glucose_readings"
  ON glucose_readings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Read-only for biomarker_types (public registry)
ALTER TABLE biomarker_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biomarker_types_public_read"
  ON biomarker_types FOR SELECT
  USING (true);

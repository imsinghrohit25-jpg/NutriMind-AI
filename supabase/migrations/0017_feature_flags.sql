-- Migration: 0017_feature_flags
-- Purpose: Feature flag table for Global Enterprise Edition.
-- All new global.* flags default to false — existing India features unaffected.
-- Rollback: see 0017_feature_flags_rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS feature_flags (
  key          text        NOT NULL,
  enabled      boolean     NOT NULL DEFAULT false,
  country_code text        NULL,             -- NULL = all countries; 'IN' = India only
  rollout_pct  integer     NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  description  text        NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid        NULL REFERENCES auth.users(id),
  PRIMARY KEY (key, COALESCE(country_code, ''))
);

COMMENT ON TABLE feature_flags IS
  'Remote-controlled feature flags. key+country_code is the unique gate. '
  'NULL country_code = applies to all countries. '
  'Global Enterprise Edition flags are namespaced global.pN.*';

CREATE INDEX idx_feature_flags_country
  ON feature_flags (country_code)
  WHERE country_code IS NOT NULL;

-- RLS: read-only for authenticated users, write via service role only
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flags_read_all_authenticated"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert/update/delete (no RLS restriction for service role)

-- Seed: all Phase 1–10 global flags, disabled by default
INSERT INTO feature_flags (key, enabled, country_code, description) VALUES
  -- Phase 1 — Country Intelligence
  ('global.p1.country_engine',        false, NULL, 'Country Intelligence Engine (Phase 1)'),
  ('global.p1.travel_transition_ux',  false, NULL, 'Travel transition UX (Phase 1)'),

  -- Phase 2 — Localization
  ('global.p2.localization_rtl',      false, NULL, 'RTL layout support (Phase 2)'),
  ('global.p2.tier_b_languages',      false, NULL, 'Tier B language pack loading (Phase 2)'),
  ('global.p2.numeral_rendering',     false, NULL, 'Locale-specific numeral rendering (Phase 2)'),
  ('global.p2.code_switching',        false, NULL, 'Code-switching in UI (Phase 2)'),

  -- Phase 3 — Global Food Database
  ('global.p3.unified_food_schema',   false, NULL, 'Unified global food schema (Phase 3)'),
  ('global.p3.regional_device_packs', false, NULL, 'Regional device data packs (Phase 3)'),
  ('global.p3.cofid_ingestion',       false, NULL, 'CoFID UK food data ingestion (Phase 3)'),

  -- Phase 4 — Nutrition Rule Engine
  ('global.p4.multi_standard_rules',  false, NULL, 'Multi-country nutrition rule packs (Phase 4)'),
  ('global.p4.life_stage_rules',      false, NULL, 'Life-stage specific rules (Phase 4)'),
  ('global.p4.condition_rules',       false, NULL, 'Medical condition rule overlays (Phase 4)'),
  ('global.p4.allergen_regime_map',   false, NULL, 'Per-country allergen regime (FDA-9/EU-14/JP-8) (Phase 4)'),

  -- Phase 5 — Grocery & Restaurant Intelligence
  ('global.p5.grocery_provider_chain',    false, NULL, 'Global grocery provider chain (Phase 5)'),
  ('global.p5.restaurant_etl',            false, NULL, 'Restaurant chain nutrition ETL (Phase 5)'),
  ('global.p5.estimated_nutrition_label', false, NULL, 'AI-estimated nutrition label (Phase 5)'),

  -- Phase 6 — OCR & Voice
  ('global.p6.cloud_ocr_fallback',    false, NULL, 'Cloud Vision OCR for unsupported scripts (Phase 6)'),
  ('global.p6.label_format_router',   false, NULL, 'International nutrition label format routing (Phase 6)'),
  ('global.p6.cloud_stt',             false, NULL, 'Cloud STT for Tier-2 countries (Phase 6)'),
  ('global.p6.wake_word',             false, NULL, 'Wake word detection (Phase 6, Porcupine)'),

  -- Phase 7 — Multi-Region
  ('global.p7.multi_region_routing',  false, NULL, 'Edge routing + data residency (Phase 7)'),
  ('global.p7.edge_caching',          false, NULL, 'Cloudflare KV edge caching (Phase 7)'),

  -- Phase 8 — Privacy
  ('global.p8.gdpr_consent_flow',     false, NULL, 'GDPR-specific consent flow (Phase 8)'),
  ('global.p8.dpdp_consent_flow',     false, NULL, 'DPDP Act 2023 consent flow (Phase 8)'),
  ('global.p8.dsr_endpoints',         false, NULL, 'GDPR/CCPA DSR export+erase endpoints (Phase 8)'),

  -- Phase 9 — Performance
  ('global.p9.incremental_regional_sync', false, NULL, 'Incremental regional data sync (Phase 9)'),
  ('global.p9.deferred_components',       false, NULL, 'Flutter deferred component loading (Phase 9)'),

  -- Phase 10 — Onboarding
  ('global.p10.country_onboarding_v2', false, NULL, 'Global country onboarding flow v2 (Phase 10)')

ON CONFLICT DO NOTHING;

COMMIT;

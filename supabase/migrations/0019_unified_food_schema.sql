-- Migration: 0019_unified_food_schema
-- Purpose: Extend product catalog for global food data sources (Phase 3).
-- Changes:
--   1. products: add country_codes (ISO-3166 array) + source_region (primary region of data source)
--   2. data_sources: insert CoFID 2021, EFSA 2021, CIQUAL 2020, BLS 3.02, FSANZ rows
-- Rollback: see 0019_unified_food_schema_rollback.sql

BEGIN;

-- 1a. Add country_codes to products — which markets this product is sold in.
--     NULL = unknown/not yet populated. Empty array = globally available.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS country_codes text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.products.country_codes IS
  'ISO-3166-1 alpha-2 codes of markets where this product is known to be sold. '
  'Empty array means unknown (not "no markets"). '
  'Populated by Phase 3 country-aware waterfall.';

-- 1b. Add source_region — the ISO code of the primary data source region.
--     Used to select the most authoritative source for a given country.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_region text NULL;

COMMENT ON COLUMN public.products.source_region IS
  'ISO-3166-1 code of the data source primary region (e.g. GB for CoFID, IN for IFCT, null for global sources).';

-- Index for region-filtered queries.
CREATE INDEX IF NOT EXISTS idx_products_country_codes
  ON public.products USING GIN (country_codes);

CREATE INDEX IF NOT EXISTS idx_products_source_region
  ON public.products (source_region)
  WHERE source_region IS NOT NULL;

-- 2. Register global food composition data sources.
INSERT INTO public.data_sources (id, display_name, base_url, license_class, attribution_text, terms_url, is_active)
VALUES
  -- UK: CoFID (Composition of Foods Integrated Dataset, Public Health England / FSA)
  ('cofid_2021',
   'CoFID 2021 — UK Composition of Foods',
   'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
   'public_domain',
   'Contains public sector information licensed under the Open Government Licence v3.0.',
   'https://www.nationalarchives.gov.uk/doc/open-government-licence/',
   true),

  -- EU: EFSA (European Food Safety Authority — Comprehensive European Food Consumption Database)
  ('efsa_2021',
   'EFSA 2021 — European Food Composition',
   'https://www.efsa.europa.eu/en/data-report/food-consumption-data',
   'licensed_restricted',
   'Source: European Food Safety Authority (EFSA). Used under EFSA data use policy.',
   'https://www.efsa.europa.eu/en/data/data-use-policy',
   false),  -- disabled until ETL is complete in Phase 4

  -- France: CIQUAL (Agence Nationale de Sécurité Sanitaire de l'Alimentation)
  ('ciqual_2020',
   'CIQUAL 2020 — French Food Composition Table',
   'https://ciqual.anses.fr/',
   'public_domain',
   'CIQUAL — French Food Composition Table, ANSES 2020. Data available under Etalab Open Licence.',
   'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
   false),

  -- Germany: BLS (Bundeslebensmittelschlüssel)
  ('bls_3_02',
   'BLS 3.02 — German Federal Food Key',
   'https://www.mri.bund.de/en/databases/bls/',
   'licensed_restricted',
   'Source: Max Rubner-Institut, German Federal Research Institute of Nutrition and Food.',
   'https://www.mri.bund.de/',
   false),

  -- Australia/NZ: FSANZ (Food Standards Australia New Zealand)
  ('fsanz_2019',
   'FSANZ 2019 — Australian Food Composition Database',
   'https://www.foodstandards.gov.au/science/monitoringnutrients/afcd/',
   'public_domain',
   'Food Standards Australia New Zealand (FSANZ). © Commonwealth of Australia, 2019.',
   'https://www.foodstandards.gov.au/about-us/legal-notices/copyright',
   false)

ON CONFLICT (id) DO UPDATE SET
  display_name   = EXCLUDED.display_name,
  base_url       = EXCLUDED.base_url,
  attribution_text = EXCLUDED.attribution_text,
  is_active      = EXCLUDED.is_active;

COMMIT;

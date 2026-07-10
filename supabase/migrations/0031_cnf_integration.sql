-- Migration 0031: Canadian Nutrient File (CNF) integration — purely additive.
-- Rollback: supabase/migrations/0031_cnf_integration_rollback.sql
-- ADR: docs/adr/ADR-0032-cnf-2026-integration.md
--
-- STRICTLY ADDITIVE — no existing table, column, constraint, or row is altered.
--   - `data_sources`: one new reference row (cnf_2026). Existing rows untouched.
--   - `food_groups`: reused as-is (existing table already has a generic TEXT `code` + `source`
--     FK design from the IFCT integration — CNF's own numeric food-group codes fit it directly,
--     no schema change needed). Existing IFCT food_groups rows untouched.
--   - `product_portions` (NEW TABLE): CNF is the first source in this codebase to ship real
--     multi-measure household/yield/refuse conversion data (`Measure_Weight_Conversion.csv`,
--     ~29,868 rows) — `products.serving_size_g`/`serving_description` only ever modeled ONE
--     portion per product, so this data has no existing home. Generic by design (not CNF-specific
--     naming) so a future source with the same real need can reuse it without a second table.
--   - `product_aliases` (NEW TABLE): CNF is bilingual by Health Canada mandate (English + French
--     names, food-group names, measure names) — no existing table holds a second-language name
--     for anything. Generic by design for the same reason as `product_portions`.
--   - `import_batches` (NEW TABLE): lightweight audit trail (checksum, status, counts, error) for
--     this bulk file import — no existing table tracks import provenance at the batch level today
--     (prior IFCT/USDA imports only ever wrote a docs/imports/*.md report, no DB-tracked history).

BEGIN;

INSERT INTO public.data_sources (id, display_name, base_url, license_class, attribution_text, terms_url, is_active)
VALUES (
  'cnf_2026',
  'Canadian Nutrient File (Health Canada)',
  'https://food-nutrition.canada.ca/cnf-fce/',
  'public_domain',
  'Nutrient values from the Canadian Nutrient File, Health Canada, reproduced under the Open Government Licence – Canada.',
  'https://open.canada.ca/en/open-government-licence-canada',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- product_portions — real household/yield/refuse measure conversions. Generic:
-- measure_type distinguishes CNF's own Measure_Type_Code semantics (verified directly against
-- the real file, not assumed): 'household' (grams per named measure, e.g. "1 cup"), 'yield'
-- (grams of raw/uncooked food needed to yield a named prepared measure), 'refuse' (percentage,
-- 0-100, of inedible portion — a genuinely different unit from the other two, hence value_unit).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_portions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  measure_type      TEXT NOT NULL CHECK (measure_type IN ('household', 'yield', 'refuse')),
  description_en    TEXT NOT NULL,
  description_fr    TEXT,
  value             NUMERIC(10,3) NOT NULL,
  value_unit        TEXT NOT NULL CHECK (value_unit IN ('g', 'pct')),
  source            TEXT NOT NULL REFERENCES public.data_sources(id),
  source_measure_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, measure_type, description_en)
);

COMMENT ON TABLE public.product_portions IS
  'Real household-measure / yield / refuse-percentage conversions for a product. First populated '
  'by the CNF integration (Measure_Weight_Conversion.csv) — generic, not CNF-specific, for reuse '
  'by any future source with the same real multi-measure data (ADR-0032).';

ALTER TABLE public.product_portions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_portions_read_all_authenticated"
  ON public.product_portions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_portions_service_write"
  ON public.product_portions FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- ─────────────────────────────────────────────────────────────────────────────
-- product_aliases — a second-language (or alternate) name for a product. Generic by design.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_aliases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  alias_name    TEXT NOT NULL,
  alias_type    TEXT NOT NULL CHECK (alias_type IN ('translation', 'alternate', 'scientific')),
  source        TEXT NOT NULL REFERENCES public.data_sources(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, language_code, alias_type, alias_name)
);

COMMENT ON TABLE public.product_aliases IS
  'A second-language or alternate name for a product. First populated by the CNF integration '
  '(French names are a Health Canada bilingual mandate) — generic, not CNF-specific (ADR-0032).';

ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_aliases_read_all_authenticated"
  ON public.product_aliases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_aliases_service_write"
  ON public.product_aliases FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- ─────────────────────────────────────────────────────────────────────────────
-- import_batches — lightweight audit trail for bulk file imports (checksum, status, counts).
-- Not specific to CNF; any future bulk-file source can log a row here too.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL REFERENCES public.data_sources(id),
  dataset_version   TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'rolled_back')),
  file_checksums    JSONB,
  rows_parsed       INTEGER,
  rows_imported     INTEGER,
  rows_rejected     INTEGER,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.import_batches IS
  'Audit trail for bulk dataset imports (checksums, status, row counts). First populated by the '
  'CNF integration (ADR-0032) — no prior source tracked import provenance at the batch level.';

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_batches_read_all_authenticated"
  ON public.import_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "import_batches_service_write"
  ON public.import_batches FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

COMMIT;

-- Migration 0029: IFCT 2017 integration — minimal product_nutrition extensions
-- Rollback: supabase/migrations/0029_ifct_nutrient_extensions_rollback.sql
-- ADR: docs/adr/ADR-0031-ifct-2017-real-source-integration.md
--
-- Four additive, nullable columns. No existing column, row, query, or constraint is touched.
--   - ash_g, moisture_g: genuinely new proximates the existing 26-column schema never modeled
--     (needed to represent IFCT Table 1 completely).
--   - nutrient_sd: {nutrient_key: sd} for every nutrient a source reported a standard deviation
--     for. One JSONB column rather than a paired _sd column per nutrient (would require ~150 new
--     columns across this integration's full scope) or a full EAV redesign (out of scope — see
--     the ADR's schema-decision section).
--   - nutrient_value_state: {nutrient_key: 'measured'|'zero'|'trace'|'not_detected'|'not_analyzed'}
--     — without this, "not analyzed" and "confirmed zero" both collapse to SQL NULL, which the
--     existing columns have always done. New IFCT rows populate it; existing non-IFCT rows are
--     unaffected (no backfill implied or attempted).

BEGIN;

ALTER TABLE public.product_nutrition
  ADD COLUMN IF NOT EXISTS ash_g NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS moisture_g NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS nutrient_sd JSONB,
  ADD COLUMN IF NOT EXISTS nutrient_value_state JSONB;

COMMENT ON COLUMN public.product_nutrition.ash_g IS
  'Total ash, g/100g. New with IFCT 2017 integration (ADR-0031) — not modeled by any prior source.';
COMMENT ON COLUMN public.product_nutrition.moisture_g IS
  'Moisture/water content, g/100g. New with IFCT 2017 integration (ADR-0031).';
COMMENT ON COLUMN public.product_nutrition.nutrient_sd IS
  'Standard deviation per nutrient, keyed by the same field name as its value column '
  '(e.g. {"protein_g": 0.29}). Populated for sources that report variability (IFCT 2017 regional '
  'composites). NULL/absent key means no SD was reported for that nutrient.';
COMMENT ON COLUMN public.product_nutrition.nutrient_value_state IS
  'Per-nutrient value semantics, keyed by field name: measured | zero | trace | not_detected | '
  'not_analyzed. Distinguishes "confirmed zero" and "not analyzed" from each other and from a '
  'plain NULL, per ADR-0031. Absent key = state unknown (pre-existing sources, not backfilled).';

-- ─────────────────────────────────────────────────────────────────────────────
-- food_groups — IFCT's real 20-group registry (A-T), reference data (public read, service write).
-- New table: no existing schema modeled food-group taxonomy at all.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.food_groups (
  code            TEXT PRIMARY KEY,          -- IFCT's own letter code, e.g. 'A'
  display_name    TEXT NOT NULL,
  source          TEXT NOT NULL REFERENCES public.data_sources(id),
  food_entry_count INTEGER CHECK (food_entry_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.food_groups IS
  'Food group taxonomy, seeded from IFCT 2017''s own registry (book page xxi). Reference data, '
  'not user-owned. food_entry_count is the book''s own published count for that group.';

ALTER TABLE public.food_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_groups_read_all_authenticated"
  ON public.food_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "food_groups_service_write"
  ON public.food_groups FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Seed: the real 20 groups (A-T), from the book's own "Table 1. Food groups in the IFCT" (p. xxi).
-- Group T (Edible Oils and Fats) has no proximate/vitamin/mineral data of its own — it is covered
-- only by Table 12's fatty-acid profile, which is why 528 (A-S) and 542 (A-T) are both correct
-- depending on the question being asked (see ADR-0031 §1).
INSERT INTO public.food_groups (code, display_name, source, food_entry_count) VALUES
  ('A', 'Cereals and Millets',              'ifct_2017', 24),
  ('B', 'Grain Legumes',                    'ifct_2017', 25),
  ('C', 'Green Leafy Vegetables',           'ifct_2017', 34),
  ('D', 'Other Vegetables',                 'ifct_2017', 78),
  ('E', 'Fruits',                           'ifct_2017', 68),
  ('F', 'Roots and Tubers',                 'ifct_2017', 19),
  ('G', 'Condiments and Spices',            'ifct_2017', 33),
  ('H', 'Nuts and Oil Seeds',               'ifct_2017', 21),
  ('I', 'Sugars',                           'ifct_2017', 2),
  ('J', 'Mushrooms',                        'ifct_2017', 4),
  ('K', 'Miscellaneous Foods',              'ifct_2017', 2),
  ('L', 'Milk and Milk Products',           'ifct_2017', 4),
  ('M', 'Egg and Egg Products',             'ifct_2017', 15),
  ('N', 'Poultry',                          'ifct_2017', 19),
  ('O', 'Animal Meat',                      'ifct_2017', 63),
  ('P', 'Marine Fish',                      'ifct_2017', 92),
  ('Q', 'Marine Shellfish',                 'ifct_2017', 8),
  ('R', 'Marine Mollusks',                  'ifct_2017', 7),
  ('S', 'Fresh Water Fish and Shellfish',   'ifct_2017', 10),
  ('T', 'Edible Oils and Fats',             'ifct_2017', 14)
ON CONFLICT (code) DO NOTHING;

COMMIT;

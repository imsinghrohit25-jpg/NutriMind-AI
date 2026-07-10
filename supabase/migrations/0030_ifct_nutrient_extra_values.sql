-- Migration 0030: generic nutrient-value sidecar — correction found while starting ADR-0031 §5.
-- Rollback: supabase/migrations/0030_ifct_nutrient_extra_values_rollback.sql
-- ADR: docs/adr/ADR-0031-ifct-2017-real-source-integration.md (dated addendum, §5 continuation)
--
-- Migration 0029 added nutrient_sd (per-nutrient standard deviation) and nutrient_value_state
-- (per-nutrient measured/zero/trace/not_detected/not_analyzed) — but neither holds the actual
-- MEASURED VALUE for a nutrient that has no dedicated named column. That gap was invisible while
-- only Table 1 (proximates) was implemented, because every Table 1 nutrient already had a
-- dedicated column (protein_g, fat_total_g, ash_g, moisture_g, etc). It became load-bearing at
-- Table 2 (Water-Soluble Vitamins): thiamine/riboflavin/niacin/folate/vitamin C DO have dedicated
-- columns (already used by other sources), but pantothenic acid, vitamin B6, and biotin do not,
-- and per ADR-0031 §5's own decision, they must NOT get ~150 new dedicated columns across the
-- full 12-table rollout (schema-bloat problem the ADR explicitly rejected) — they route through
-- this same additive-JSONB pattern instead.
--
-- One column, keyed identically to nutrient_sd/nutrient_value_state (by the same field-name
-- convention, e.g. {"pantothenicAcidMg": 0.87, "biotinMcg": 0.76}), holds the value itself.
-- Additive, nullable, zero impact on any existing row/query.

BEGIN;

ALTER TABLE public.product_nutrition
  ADD COLUMN IF NOT EXISTS nutrient_extra JSONB;

COMMENT ON COLUMN public.product_nutrition.nutrient_extra IS
  'Measured value for a nutrient that has no dedicated named column, keyed by the same field-name '
  'convention as nutrient_sd/nutrient_value_state (e.g. {"pantothenicAcidMg": 0.87}). Added at '
  'ADR-0031 Table 2 (Water-Soluble Vitamins) once dedicated per-nutrient columns stopped scaling.';

COMMIT;

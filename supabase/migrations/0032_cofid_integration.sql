-- Migration 0032: UK CoFID (McCance and Widdowson's Composition of Foods Integrated Dataset)
-- integration — additive, plus one real bug fix found while preparing this integration.
-- Rollback: supabase/migrations/0032_cofid_integration_rollback.sql
-- ADR: docs/adr/ADR-0033-cofid-2021-integration.md
--
-- STRICTLY ADDITIVE for CoFID itself:
--   - `data_sources`: one new reference row (cofid_2021). Existing rows untouched.
--   - No new tables needed — CoFID reuses `product_portions`/`product_aliases`/`import_batches`
--     (generic, established by the CNF integration) as-is; CoFID populates neither portions (this
--     workbook edition ships no household-measure sheet — never invented) nor aliases (verified:
--     its "Description" column is sample/provenance text, e.g. "8 cans", "Literature sources" —
--     not an alternate food name, so it is deliberately never written there).
--
-- ONE REAL BUG FIX (not additive, but zero blast radius — see below):
--   `food_groups.code` was a bare, globally-unique PRIMARY KEY with no per-source scoping. This
--   was invisible with only IFCT (single letters A-T) + CNF (pure numeric 1-25) since their
--   vocabularies never overlapped. CoFID's own 121-code taxonomy (verified directly against the
--   real workbook: A, AA, AB, ..., H, J, ..., S, ...) DOES collide — e.g. CoFID's group "H" and
--   IFCT's group "H" ("Nuts and Oil Seeds") are different, unrelated categories that would fight
--   over the same primary-key row via `ON CONFLICT (code) DO NOTHING`, corrupting whichever
--   source's food_groups metadata was NOT inserted first. Fixed by widening the primary key to
--   (source, code) — the natural, correct scope for what has always really been a per-source
--   vocabulary. Verified zero blast radius: no other table has a foreign key to food_groups (it is
--   a lookup table read only at import time, its resolved display name copied directly into
--   products.category — never joined against live by any route/API), so widening its PK changes
--   no query path anywhere in the codebase.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Real bug fix: food_groups needs per-source scoping, not a bare global code PK.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.food_groups DROP CONSTRAINT food_groups_pkey;
ALTER TABLE public.food_groups ADD CONSTRAINT food_groups_pkey PRIMARY KEY (source, code);

COMMENT ON TABLE public.food_groups IS
  'Per-source food group / category lookup, read only at import time (no live FK from any other '
  'table). Primary key is (source, code) — group-code vocabularies are per-source, never a shared '
  'global namespace (fixed in migration 0032 after CoFID''s own taxonomy was found to collide with '
  'IFCT''s single-letter codes under the previous bare-code PK; see ADR-0033).';

-- ─────────────────────────────────────────────────────────────────────────────
-- CoFID data source registration.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.data_sources (id, display_name, base_url, license_class, attribution_text, terms_url, is_active)
VALUES (
  'cofid_2021',
  'UK Composition of Foods Integrated Dataset (CoFID), McCance and Widdowson''s',
  'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
  'public_domain',
  'Nutrient values from McCance and Widdowson''s Composition of Foods Integrated Dataset (CoFID), Public Health England / Office for Health Improvement and Disparities, reproduced under the Open Government Licence v3.0.',
  'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  true
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

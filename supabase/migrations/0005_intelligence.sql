-- Migration 0005: Intelligence — health_scores, ingredient_assessments, member_safety_evaluations
-- Rollback: supabase/migrations/rollback/0005_rollback.sql
-- Validate: supabase/migrations/validate/0005_validate.sql
--
-- Design notes:
--   health_scores is written ONLY by the pure-function engine in apps/api/src/engines/score/.
--   No LLM call path reaches this table (enforced by CI audit scripts/audit-llm-writes.ts).
--   input_snapshot stores full engine inputs for auditability (D3 Glass-box score).
--   algorithm_version enables rolling out new scoring models without losing history.

-- ---------------------------------------------------------------------------
-- health_scores
-- ---------------------------------------------------------------------------
CREATE TABLE public.health_scores (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- NULL user_id + NULL member_id = canonical (non-personalized) score
  user_id                 UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id               UUID        REFERENCES public.household_members(id) ON DELETE SET NULL,
  algorithm_version       TEXT        NOT NULL,
  -- Full engine inputs at computation time for reproducibility audit
  input_snapshot          JSONB       NOT NULL,
  -- Sub-scores 0–100 (pure-function outputs; no LLM influence)
  score_overall           SMALLINT    NOT NULL CHECK (score_overall BETWEEN 0 AND 100),
  score_nutrition         SMALLINT    NOT NULL CHECK (score_nutrition BETWEEN 0 AND 100),
  score_processing        SMALLINT    NOT NULL CHECK (score_processing BETWEEN 0 AND 100),
  score_additives         SMALLINT    NOT NULL CHECK (score_additives BETWEEN 0 AND 100),
  score_allergen_risk     SMALLINT    NOT NULL CHECK (score_allergen_risk BETWEEN 0 AND 100),
  personalization_applied BOOLEAN     NOT NULL DEFAULT false,
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique indexes for the three score variants
CREATE UNIQUE INDEX health_scores_canonical_uniq
  ON public.health_scores (product_id, algorithm_version)
  WHERE user_id IS NULL AND member_id IS NULL;

CREATE UNIQUE INDEX health_scores_user_uniq
  ON public.health_scores (product_id, user_id, algorithm_version)
  WHERE user_id IS NOT NULL AND member_id IS NULL;

CREATE UNIQUE INDEX health_scores_member_uniq
  ON public.health_scores (product_id, member_id, algorithm_version)
  WHERE member_id IS NOT NULL;

CREATE INDEX health_scores_product_idx ON public.health_scores(product_id);
CREATE INDEX health_scores_user_idx    ON public.health_scores(user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ingredient_assessments  (per-ingredient concern level; engine output)
-- ---------------------------------------------------------------------------
CREATE TABLE public.ingredient_assessments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id     UUID        REFERENCES public.ingredients(id) ON DELETE SET NULL,
  display_text      TEXT        NOT NULL,
  concern_level     TEXT        NOT NULL CHECK (concern_level IN ('safe','caution','avoid','unknown')),
  concern_reason    TEXT,
  fssai_reference   TEXT,
  algorithm_version TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ingredient_assessments_product_idx    ON public.ingredient_assessments(product_id);
CREATE INDEX ingredient_assessments_ingredient_idx ON public.ingredient_assessments(ingredient_id) WHERE ingredient_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- member_safety_evaluations  (allergen gate output; per-scan, per-member)
-- Fail-safe: if fail_safe_triggered = true, overall_safety = 'unknown' is
-- treated as 'unsafe' in the UI — never silently suppressed.
-- ---------------------------------------------------------------------------
CREATE TABLE public.member_safety_evaluations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id              UUID        NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  member_id            UUID        NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  product_id           UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  allergen_triggered   TEXT[]      NOT NULL DEFAULT '{}',
  condition_flags      TEXT[]      NOT NULL DEFAULT '{}',
  diet_flags           TEXT[]      NOT NULL DEFAULT '{}',
  overall_safety       TEXT        NOT NULL CHECK (overall_safety IN ('safe','caution','unsafe','unknown')),
  -- fail_safe_triggered: true when parse uncertainty prevents confident evaluation
  fail_safe_triggered  BOOLEAN     NOT NULL DEFAULT false,
  algorithm_version    TEXT        NOT NULL,
  evaluated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX member_safety_scan_idx    ON public.member_safety_evaluations(scan_id);
CREATE INDEX member_safety_member_idx  ON public.member_safety_evaluations(member_id);
CREATE INDEX member_safety_product_idx ON public.member_safety_evaluations(product_id);

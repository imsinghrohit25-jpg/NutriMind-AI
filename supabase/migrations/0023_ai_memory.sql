-- Migration: 0023_ai_memory
-- Purpose: Phase 11 (AI Memory System) — the four-layer memory architecture's schema.
-- Layer 1 (episodic): user_events, append-only, partitioned by month.
-- Layer 2 (derived):  user_memory_facts, versioned + decayed (valid_until).
-- Layer 3 (semantic): user_memory_embeddings, pgvector (extension already enabled, 0001).
-- Reference data:     seasonal_produce (Tier-1 countries, seeded separately — see
--                      apps/api/src/memory/seasonal-produce-data.ts / 0023b seed file).
-- Adaptive loop:       recommendation_feedback.
-- Rollback: see 0023_ai_memory_rollback.sql
--
-- Partitioning note: user_events is RANGE-partitioned by month (occurred_at) — a real, standard
-- Postgres feature matching the stated 24-months-hot retention policy. This is NOT the same
-- thing as user-hash cross-node sharding for 100M-user horizontal scale (that requires a
-- distributed Postgres topology — Citus, or per-region Supabase projects per Phase 7's region
-- model — a separate infra decision, not something a single migration can deliver; see
-- ADR-0025 §Scale honesty).

BEGIN;

-- ---------------------------------------------------------------------------
-- user_events (Layer 1 — episodic memory, append-only, source of truth)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_events (
  event_id      UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL CHECK (event_type IN (
    'food_logged', 'meal_planned', 'meal_skipped', 'recipe_cooked', 'barcode_scanned',
    'restaurant_visit', 'grocery_purchase', 'biomarker_reading', 'goal_set', 'goal_progress',
    'country_transition', 'feedback_given', 'recommendation_accepted', 'recommendation_rejected'
  )),
  payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT        NOT NULL DEFAULT 'api',
  schema_version SMALLINT   NOT NULL DEFAULT 1,
  PRIMARY KEY (event_id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Helper: create a monthly partition for user_events if it doesn't already exist. Called by
-- this migration for a rolling window, and re-callable by the aggregation job to extend ahead.
CREATE OR REPLACE FUNCTION public.ensure_user_events_partition(month_start date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  partition_name text := 'user_events_' || to_char(month_start, 'YYYY_MM');
  month_end date := month_start + interval '1 month';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.user_events FOR VALUES FROM (%L) TO (%L)',
      partition_name, month_start, month_end
    );
  END IF;
END;
$$;

-- Pre-create a rolling window: 2 months back through 3 months ahead.
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN -2..3 LOOP
    PERFORM public.ensure_user_events_partition(date_trunc('month', now() + (i || ' month')::interval)::date);
  END LOOP;
END;
$$;

CREATE INDEX user_events_user_time_idx ON public.user_events(user_id, occurred_at DESC);
CREATE INDEX user_events_type_idx ON public.user_events(event_type, occurred_at DESC);

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_events: owner select"
  ON public.user_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_events: owner insert"
  ON public.user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_events IS
  'Append-only episodic memory event log (Phase 11, AI Memory System Layer 1). Never updated, only inserted. Source of truth every derived fact must trace back to via derived_from.';

-- ---------------------------------------------------------------------------
-- user_memory_facts (Layer 2 — derived profile, deterministic aggregation output)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_memory_facts (
  fact_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_type    TEXT        NOT NULL CHECK (fact_type IN (
    'eating_pattern', 'user_habit', 'health_goal', 'family_preference',
    'regional_cuisine_affinity', 'travel_history', 'seasonal_pattern'
  )),
  -- fact_key namespaces multiple facts of the same fact_type for one user, e.g.
  -- fact_type='eating_pattern', fact_key='meal_timing_breakfast'.
  fact_key     TEXT        NOT NULL,
  value        JSONB       NOT NULL,
  confidence   NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  -- Lineage: the user_events this fact was computed from — every fact must be traceable,
  -- never an LLM-divined value written directly (see ADR-0025 §Derived, never divined).
  derived_from UUID[]      NOT NULL DEFAULT '{}',
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Half-life decay: a fact past valid_until is stale and excluded from context assembly
  -- (still queryable for the transparency UI/audit, just not used for personalization).
  valid_until  TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, fact_type, fact_key)
);

CREATE INDEX user_memory_facts_user_idx ON public.user_memory_facts(user_id, fact_type);
CREATE INDEX user_memory_facts_valid_idx ON public.user_memory_facts(user_id, valid_until);

ALTER TABLE public.user_memory_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_memory_facts: owner select"
  ON public.user_memory_facts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_memory_facts: owner delete"
  ON public.user_memory_facts FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_memory_facts IS
  'Deterministically-aggregated profile facts (Phase 11, Layer 2). One row per (user, fact_type, fact_key) — re-aggregation upserts, preserving the unique key so recompute never duplicates. Owner can SELECT/DELETE directly (memory transparency UI, DSR-adjacent per-item delete) but not INSERT/UPDATE — only the aggregation job (service role) writes facts.';

-- ---------------------------------------------------------------------------
-- user_memory_embeddings (Layer 3 — semantic memory, retrieval only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_memory_embeddings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_type    TEXT        NOT NULL CHECK (ref_type IN ('liked_food', 'disliked_food', 'feedback_text', 'recipe_interaction')),
  ref_id      TEXT        NOT NULL,
  text_content TEXT       NOT NULL,
  embedding   vector(1536) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_type, ref_id)
);

CREATE INDEX user_memory_embeddings_user_idx ON public.user_memory_embeddings(user_id);
CREATE INDEX user_memory_embeddings_vector_idx ON public.user_memory_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE public.user_memory_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_memory_embeddings: owner select"
  ON public.user_memory_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_memory_embeddings: owner delete"
  ON public.user_memory_embeddings FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_memory_embeddings IS
  'Semantic memory (Phase 11, Layer 3) — retrieval/ranking only, never a fact source. Residency-pinned with the user (same region as their Supabase project, Phase 7); erased on DSR.';

-- RPC: match_user_memory — semantic similarity search scoped to one user, mirrors
-- match_scan_history's cross-user-RLS-safe pattern (migration 0011).
CREATE OR REPLACE FUNCTION public.match_user_memory(
  p_user_id       uuid,
  query_embedding vector(1536),
  p_ref_type      text DEFAULT NULL,
  match_count     int DEFAULT 10
)
RETURNS TABLE(
  ref_type     text,
  ref_id       text,
  text_content text,
  similarity   float
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    e.ref_type,
    e.ref_id,
    e.text_content,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.user_memory_embeddings e
  WHERE e.user_id = p_user_id
    AND (p_ref_type IS NULL OR e.ref_type = p_ref_type)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- seasonal_produce (reference data — not user-owned, shared, no RLS needed)
-- ---------------------------------------------------------------------------
-- region is nullable (NULL = countrywide) — a plain UNIQUE(country_code, region, month) would
-- NOT dedupe rows where region IS NULL (Postgres treats every NULL as distinct for uniqueness
-- purposes), the exact pitfall fixed in feature_flags (migration 0017, see that file's comment
-- for the full explanation). Same fix here: COALESCE the nullable column in a UNIQUE INDEX
-- rather than relying on a plain multi-column UNIQUE constraint.
CREATE TABLE public.seasonal_produce (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT       NOT NULL,
  region      TEXT        NULL,          -- NULL = countrywide
  month       SMALLINT    NOT NULL CHECK (month BETWEEN 1 AND 12),
  items       TEXT[]      NOT NULL,
  source      TEXT        NOT NULL      -- provenance citation
);

CREATE UNIQUE INDEX seasonal_produce_country_region_month_uidx
  ON public.seasonal_produce (country_code, COALESCE(region, ''), month);

CREATE INDEX seasonal_produce_country_month_idx ON public.seasonal_produce(country_code, month);

COMMENT ON TABLE public.seasonal_produce IS
  'Reference data (Phase 11) — seasonal produce calendars per country/region/month, with a source citation per row. Shared across users, no PII, no RLS required.';

-- ---------------------------------------------------------------------------
-- recommendation_feedback (adaptive loop input — also mirrored as a user_events row)
-- ---------------------------------------------------------------------------
CREATE TABLE public.recommendation_feedback (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id UUID        NOT NULL,
  action            TEXT        NOT NULL CHECK (action IN ('accepted', 'rejected', 'modified')),
  reason            TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX recommendation_feedback_user_idx ON public.recommendation_feedback(user_id, created_at DESC);

ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendation_feedback: owner select"
  ON public.recommendation_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recommendation_feedback: owner insert"
  ON public.recommendation_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.recommendation_feedback IS
  'Adaptive feedback loop input (Phase 11, §12.3) — the ONLY adaptation mechanism. Feeds affinity fact recomputation; never online-fine-tunes a model, never self-mutates a prompt.';

COMMIT;

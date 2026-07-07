-- Migration 0009: Operations — llm_call_log, audit_log, feature_flags, curation_queue
-- Rollback: supabase/migrations/rollback/0009_rollback.sql
-- Validate: supabase/migrations/validate/0009_validate.sql
--
-- Design notes:
--   llm_call_log: written by the gateway on every LLM call; read by Grafana cost dashboard.
--   audit_log: append-only; RLS grants INSERT to service_role only, no UPDATE/DELETE.
--   curation_queue: unresolved scans enqueue here; resolved when a curator links a product.

-- ---------------------------------------------------------------------------
-- llm_call_log  (every gateway call; cost + tracing)
-- ---------------------------------------------------------------------------
CREATE TABLE public.llm_call_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- task_tier matches the routing policy table (ADR-0006)
  task_tier         TEXT        NOT NULL CHECK (task_tier IN (
                      'parse_assist','vision_analysis','copilot_reasoning',
                      'report_generation','embeddings')),
  provider          TEXT        NOT NULL,
  model             TEXT        NOT NULL,
  prompt_tokens     INTEGER     CHECK (prompt_tokens >= 0),
  completion_tokens INTEGER     CHECK (completion_tokens >= 0),
  total_tokens      INTEGER     CHECK (total_tokens >= 0),
  cost_usd          NUMERIC(12,8) CHECK (cost_usd >= 0),
  latency_ms        INTEGER     CHECK (latency_ms >= 0),
  status            TEXT        NOT NULL CHECK (status IN ('success','error','timeout','policy_blocked')),
  error_message     TEXT,
  -- OTEL trace correlation (links to Jaeger/Grafana spans)
  trace_id          TEXT,
  -- user_id: informational only; not a FK to avoid hot-path join pressure
  user_id           UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX llm_call_log_created_idx  ON public.llm_call_log(created_at DESC);
CREATE INDEX llm_call_log_tier_idx     ON public.llm_call_log(task_tier, created_at DESC);
CREATE INDEX llm_call_log_provider_idx ON public.llm_call_log(provider, created_at DESC);
CREATE INDEX llm_call_log_status_idx   ON public.llm_call_log(status) WHERE status != 'success';

-- ---------------------------------------------------------------------------
-- audit_log  (append-only; all sensitive mutations and admin operations)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  actor_role  TEXT        NOT NULL DEFAULT 'user',
  action      TEXT        NOT NULL,
  table_name  TEXT,
  record_id   TEXT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_actor_idx  ON public.audit_log(actor_id, created_at DESC);
CREATE INDEX audit_log_table_idx  ON public.audit_log(table_name, created_at DESC);
CREATE INDEX audit_log_action_idx ON public.audit_log(action, created_at DESC);

-- ---------------------------------------------------------------------------
-- feature_flags
-- ---------------------------------------------------------------------------
CREATE TABLE public.feature_flags (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL UNIQUE,
  is_enabled      BOOLEAN     NOT NULL DEFAULT false,
  rollout_percent SMALLINT    NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  description     TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_feature_flags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.handle_feature_flags_updated_at();

-- ---------------------------------------------------------------------------
-- curation_queue  (unresolved scans awaiting data enrichment)
-- ---------------------------------------------------------------------------
CREATE TABLE public.curation_queue (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id             UUID        REFERENCES public.scans(id) ON DELETE SET NULL,
  barcode             TEXT,
  product_name_hint   TEXT,
  source_hint         TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','resolved','rejected')),
  priority            SMALLINT    NOT NULL DEFAULT 0,
  assigned_to         UUID,
  resolved_product_id UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX curation_queue_status_idx ON public.curation_queue(status, priority DESC, created_at);
CREATE INDEX curation_queue_barcode_idx ON public.curation_queue(barcode) WHERE barcode IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_curation_queue_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER curation_queue_updated_at
  BEFORE UPDATE ON public.curation_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_curation_queue_updated_at();

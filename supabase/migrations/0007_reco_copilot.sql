-- Migration 0007: Recommendations, copilot conversations + messages
-- Rollback: supabase/migrations/rollback/0007_rollback.sql
-- Validate: supabase/migrations/validate/0007_validate.sql
--
-- Design notes:
--   recommendations: score_delta is computed by engine (Phase 10 alternatives ranking).
--   copilot_messages: policy_checked must be true before write for role='assistant';
--     llm_call_id links to llm_call_log for full auditability.

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE public.recommendations (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id               UUID         REFERENCES public.household_members(id) ON DELETE SET NULL,
  -- source_product_id: the product being replaced (NULL = proactive recommendation)
  source_product_id       UUID         REFERENCES public.products(id) ON DELETE SET NULL,
  recommended_product_id  UUID         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reason                  TEXT         NOT NULL,
  -- score_delta: recommended_score - source_score; always computed, never LLM-set
  score_delta             NUMERIC(5,2),
  is_budget_option        BOOLEAN      NOT NULL DEFAULT false,
  algorithm_version       TEXT         NOT NULL,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX recommendations_user_idx    ON public.recommendations(user_id, created_at DESC);
CREATE INDEX recommendations_member_idx  ON public.recommendations(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX recommendations_source_idx  ON public.recommendations(source_product_id) WHERE source_product_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- copilot_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE public.copilot_conversations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id          UUID        REFERENCES public.household_members(id) ON DELETE SET NULL,
  title              TEXT,
  -- context_product_id: conversation anchored to a specific product scan
  context_product_id UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX copilot_conversations_user_idx ON public.copilot_conversations(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.handle_copilot_conversations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER copilot_conversations_updated_at
  BEFORE UPDATE ON public.copilot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_copilot_conversations_updated_at();

-- ---------------------------------------------------------------------------
-- copilot_messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.copilot_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
  role             TEXT        NOT NULL CHECK (role IN ('user','assistant','system')),
  content          TEXT        NOT NULL,
  -- citations: [{chunk_id, document_id, text_excerpt, page}]
  citations        JSONB,
  -- Output-policy compliance (Phase 2 output-policy.ts checks before write)
  policy_checked   BOOLEAN     NOT NULL DEFAULT false,
  policy_flags     TEXT[]      NOT NULL DEFAULT '{}',
  -- LLM call traceability (FK set after llm_call_log insert)
  llm_call_id      UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX copilot_messages_conv_idx ON public.copilot_messages(conversation_id, created_at);

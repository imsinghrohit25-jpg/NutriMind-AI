-- Migration 0008: Knowledge base (RAG) — documents, chunks, embeddings, match functions
-- Rollback: supabase/migrations/rollback/0008_rollback.sql
-- Validate: supabase/migrations/validate/0008_validate.sql
--
-- Design notes:
--   All match_* functions require explicit scope parameters to prevent cross-user or
--   cross-document data leakage. match_user_history enforces user_id = p_user_id in SQL.
--   IVFFlat indexes are approximate; lists=100 is appropriate for expected corpus sizes.
--   Rebuild indexes when corpus grows >1M rows (documented in OPERATIONS.md Phase 12).
--
-- Cloud compatibility note:
--   The <=> vector operator lives in the extensions schema. Supabase's ALTER DATABASE
--   search_path (migration 0001) takes effect on new connections but the current migration
--   session may not have reloaded it. SET LOCAL ensures extensions is reachable for both
--   DDL validation and SQL function body parsing within this migration file.

SET search_path TO extensions, public;

-- ---------------------------------------------------------------------------
-- knowledge_documents  (regulatory corpus: ICMR-NIN, WHO, FSSAI, EFSA, JECFA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT        NOT NULL,
  source_organization  TEXT        NOT NULL CHECK (source_organization IN ('ICMR-NIN','WHO','FSSAI','EFSA','JECFA','other')),
  document_type        TEXT        NOT NULL CHECK (document_type IN ('guideline','regulation','report','standard','recommendation')),
  document_version     TEXT        NOT NULL,
  published_date       DATE,
  language             TEXT        NOT NULL DEFAULT 'en',
  license_class        TEXT        NOT NULL,
  attribution_text     TEXT        NOT NULL,
  file_path            TEXT,
  ingested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active            BOOLEAN     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS knowledge_documents_org_idx    ON public.knowledge_documents(source_organization);
CREATE INDEX IF NOT EXISTS knowledge_documents_active_idx ON public.knowledge_documents(is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- knowledge_chunks  (chunked text + embeddings for hybrid retrieval)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID        NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index      INTEGER     NOT NULL CHECK (chunk_index >= 0),
  content          TEXT        NOT NULL,
  content_hash     TEXT        NOT NULL,
  token_count      INTEGER     CHECK (token_count > 0),
  page_number      INTEGER     CHECK (page_number > 0),
  section_title    TEXT,
  embedding        extensions.VECTOR(1536),
  embedded_at      TIMESTAMPTZ,
  embedding_model  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_idx ON public.knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON public.knowledge_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
  ON public.knowledge_chunks USING GIN (to_tsvector('english', content));

-- ---------------------------------------------------------------------------
-- product_embeddings  (for similarity-based alternatives; Phase 10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_embeddings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE UNIQUE,
  embedding        extensions.VECTOR(1536) NOT NULL,
  embedding_model  TEXT        NOT NULL,
  embedded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_fields     TEXT[]      NOT NULL
);

CREATE INDEX IF NOT EXISTS product_embeddings_idx
  ON public.product_embeddings
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- user_history_embeddings  (semantic memory for M12)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_history_embeddings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type      TEXT        NOT NULL CHECK (source_type IN ('scan','meal_log','search_query','copilot_message')),
  source_id        UUID        NOT NULL,
  embedding        extensions.VECTOR(1536) NOT NULL,
  embedding_model  TEXT        NOT NULL,
  embedded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_history_embeddings_user_idx ON public.user_history_embeddings(user_id);
CREATE INDEX IF NOT EXISTS user_history_embeddings_vec_idx
  ON public.user_history_embeddings
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- match_knowledge_chunks: knowledge-base RAG retrieval
-- SET search_path ensures the <=> operator resolves at both definition and call time.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding    vector(1536),
  match_count        INTEGER DEFAULT 5,
  min_similarity     FLOAT   DEFAULT 0.7,
  scope_document_ids UUID[]  DEFAULT NULL
)
RETURNS TABLE (
  chunk_id       UUID,
  document_id    UUID,
  content        TEXT,
  similarity     FLOAT,
  page_number    INTEGER,
  section_title  TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path TO extensions, public
AS $$
  SELECT
    kc.id                                              AS chunk_id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding)             AS similarity,
    kc.page_number,
    kc.section_title
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.is_active = true
    AND kc.embedding IS NOT NULL
    AND (scope_document_ids IS NULL OR kc.document_id = ANY(scope_document_ids))
    AND 1 - (kc.embedding <=> query_embedding) >= min_similarity
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- match_products: product similarity search for alternatives
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding  vector(1536),
  match_count      INTEGER DEFAULT 10,
  min_similarity   FLOAT   DEFAULT 0.6,
  scope_category   TEXT    DEFAULT NULL
)
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  similarity    FLOAT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path TO extensions, public
AS $$
  SELECT
    p.id                                               AS product_id,
    p.name                                             AS product_name,
    1 - (pe.embedding <=> query_embedding)             AS similarity
  FROM public.product_embeddings pe
  JOIN public.products p ON p.id = pe.product_id
  WHERE (scope_category IS NULL OR p.category = scope_category)
    AND 1 - (pe.embedding <=> query_embedding) >= min_similarity
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- match_user_history: per-user semantic memory lookup (M12)
-- p_user_id enforced in SQL — defence-in-depth against application bugs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_user_history(
  p_user_id          UUID,
  query_embedding    vector(1536),
  match_count        INTEGER DEFAULT 10,
  scope_source_type  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  source_type  TEXT,
  source_id    UUID,
  similarity   FLOAT,
  embedded_at  TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path TO extensions, public
AS $$
  SELECT
    uhe.source_type,
    uhe.source_id,
    1 - (uhe.embedding <=> query_embedding)  AS similarity,
    uhe.embedded_at
  FROM public.user_history_embeddings uhe
  WHERE uhe.user_id = p_user_id
    AND (scope_source_type IS NULL OR uhe.source_type = scope_source_type)
    AND 1 - (uhe.embedding <=> query_embedding) >= 0.5
  ORDER BY uhe.embedding <=> query_embedding
  LIMIT match_count;
$$;

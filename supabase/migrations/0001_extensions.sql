-- Migration 0001: PostgreSQL extensions required by NutriMind
-- Rollback: supabase/migrations/rollback/0001_rollback.sql
-- Validate: supabase/migrations/validate/0001_validate.sql

-- pgcrypto: gen_random_uuid(), pgp_sym_encrypt (audit fields)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- vector: pgvector for knowledge-base and product similarity embeddings (M8, M11, M12)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- pg_trgm: GIN trigram indexes for product/ingredient name fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Expose extension functions in public search path so migrations can use gen_random_uuid() directly
ALTER DATABASE postgres SET search_path TO public, extensions;

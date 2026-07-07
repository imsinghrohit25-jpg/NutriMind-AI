-- Rollback 0001: Remove extensions
-- WARNING: dropping vector removes all vector columns; only run on empty DB.
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;

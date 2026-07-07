-- Validate 0001: Extensions present
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto') = 1,
    'pgcrypto extension missing';
  ASSERT (SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector') = 1,
    'vector (pgvector) extension missing';
  ASSERT (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_trgm') = 1,
    'pg_trgm extension missing';
  RAISE NOTICE 'validate/0001: OK — all extensions present';
END $$;

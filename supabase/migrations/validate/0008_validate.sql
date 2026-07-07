-- Validate 0008: Knowledge base tables, vector indexes, match functions
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='knowledge_documents') = 1;
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='knowledge_chunks') = 1;
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='product_embeddings') = 1;
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='user_history_embeddings') = 1;

  -- IVFFlat indexes exist
  ASSERT (SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='knowledge_chunks'
      AND indexname='knowledge_chunks_embedding_idx') = 1,
    'knowledge_chunks IVFFlat index missing';
  ASSERT (SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='product_embeddings'
      AND indexname='product_embeddings_idx') = 1,
    'product_embeddings IVFFlat index missing';

  -- match_* functions exist
  ASSERT (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='match_knowledge_chunks') = 1,
    'match_knowledge_chunks function missing';
  ASSERT (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='match_products') = 1,
    'match_products function missing';
  ASSERT (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='match_user_history') = 1,
    'match_user_history function missing';

  RAISE NOTICE 'validate/0008: OK';
END $$;

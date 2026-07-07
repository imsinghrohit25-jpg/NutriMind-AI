-- Rollback 0008: Remove knowledge base tables and match functions
DROP FUNCTION IF EXISTS public.match_user_history(UUID, extensions.VECTOR, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.match_products(extensions.VECTOR, INTEGER, FLOAT, TEXT);
DROP FUNCTION IF EXISTS public.match_knowledge_chunks(extensions.VECTOR, INTEGER, FLOAT, UUID[]);
DROP TABLE IF EXISTS public.user_history_embeddings CASCADE;
DROP TABLE IF EXISTS public.product_embeddings CASCADE;
DROP TABLE IF EXISTS public.knowledge_chunks CASCADE;
DROP TABLE IF EXISTS public.knowledge_documents CASCADE;

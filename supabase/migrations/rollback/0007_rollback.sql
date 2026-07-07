-- Rollback 0007: Remove recommendations and copilot tables
DROP TABLE IF EXISTS public.copilot_messages CASCADE;
DROP TABLE IF EXISTS public.copilot_conversations CASCADE;
DROP TABLE IF EXISTS public.recommendations CASCADE;
DROP FUNCTION IF EXISTS public.handle_copilot_conversations_updated_at();

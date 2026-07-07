-- Rollback 0010: Disable RLS and drop all policies
-- Policies are dropped automatically by ALTER TABLE ... DISABLE ROW LEVEL SECURITY
-- when CASCADE is used, but explicit drops are safer.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'users_profiles','household_members','user_consents',
    'data_sources','allergen_taxonomy',
    'products','product_nutrition','product_ingredients','product_ingredient_items','ingredients',
    'scans','scan_images',
    'health_scores','ingredient_assessments','member_safety_evaluations',
    'meal_logs','grocery_cart_sessions','grocery_cart_items','weekly_reports',
    'recommendations','copilot_conversations','copilot_messages',
    'knowledge_documents','knowledge_chunks','product_embeddings','user_history_embeddings',
    'llm_call_log','audit_log','feature_flags','curation_queue'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.is_service_role();

-- Validate 0010: RLS enabled on all tables; policies present
DO $$
DECLARE
  tbl TEXT;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
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
  FOREACH tbl IN ARRAY tables LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl;

    ASSERT rls_enabled = true, format('RLS not enabled on table: %s', tbl);

    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = tbl;

    ASSERT policy_count >= 1, format('No RLS policies on table: %s', tbl);
  END LOOP;

  -- is_service_role helper function exists
  ASSERT (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='is_service_role') = 1,
    'is_service_role function missing';

  RAISE NOTICE 'validate/0010: OK — RLS enabled on all % tables', array_length(tables, 1);
END $$;

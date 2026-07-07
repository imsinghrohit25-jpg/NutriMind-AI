-- Validate 0006: Meals, carts, reports tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['meal_logs','grocery_cart_sessions','grocery_cart_items','weekly_reports'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    ASSERT (SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_name=tbl) = 1,
      format('Table %s missing', tbl);
  END LOOP;

  -- is_estimated column present on meal_logs (D4 honesty)
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='meal_logs' AND column_name='is_estimated') = 1,
    'meal_logs.is_estimated column missing';

  -- unique constraint on weekly_reports(user_id, week_start)
  ASSERT (SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='weekly_reports'
      AND indexdef ILIKE '%user_id%week_start%') >= 1,
    'weekly_reports unique (user_id, week_start) missing';

  RAISE NOTICE 'validate/0006: OK';
END $$;

-- Validate 0002: Identity tables and triggers present
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['users_profiles','household_members','user_consents'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    ASSERT (
      SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) = 1, format('Table %s missing', tbl);
  END LOOP;

  -- Verify NOT NULL constraints on key columns
  ASSERT (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users_profiles' AND column_name='display_name'
  ) = 'NO', 'users_profiles.display_name must be NOT NULL';

  ASSERT (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='household_members' AND column_name='owner_id'
  ) = 'NO', 'household_members.owner_id must be NOT NULL';

  -- Verify updated_at triggers exist
  ASSERT (
    SELECT COUNT(*) FROM information_schema.triggers
    WHERE trigger_schema='public' AND trigger_name='users_profiles_updated_at'
  ) = 1, 'users_profiles_updated_at trigger missing';

  RAISE NOTICE 'validate/0002: OK';
END $$;

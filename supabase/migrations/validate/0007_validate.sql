-- Validate 0007: Recommendations and copilot tables
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='recommendations') = 1;
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='copilot_conversations') = 1;
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='copilot_messages') = 1;

  -- policy_checked column exists (output-policy compliance)
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='copilot_messages' AND column_name='policy_checked') = 1,
    'copilot_messages.policy_checked column missing';

  RAISE NOTICE 'validate/0007: OK';
END $$;

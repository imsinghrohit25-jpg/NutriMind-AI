-- Validate 0005: Intelligence tables + partial unique indexes
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='health_scores') = 1, 'health_scores table missing';
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='ingredient_assessments') = 1;
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='member_safety_evaluations') = 1;

  -- algorithm_version must be NOT NULL (reproducibility invariant)
  ASSERT (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='health_scores' AND column_name='algorithm_version') = 'NO',
    'health_scores.algorithm_version must be NOT NULL';

  -- input_snapshot must be NOT NULL (auditability invariant)
  ASSERT (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='health_scores' AND column_name='input_snapshot') = 'NO',
    'health_scores.input_snapshot must be NOT NULL';

  -- Partial unique indexes exist
  ASSERT (SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='health_scores'
      AND indexname='health_scores_canonical_uniq') = 1, 'health_scores_canonical_uniq missing';
  ASSERT (SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='health_scores'
      AND indexname='health_scores_member_uniq') = 1, 'health_scores_member_uniq missing';

  RAISE NOTICE 'validate/0005: OK';
END $$;

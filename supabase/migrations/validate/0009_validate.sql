-- Validate 0009: Ops tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['llm_call_log','audit_log','feature_flags','curation_queue'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    ASSERT (SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_name=tbl) = 1,
      format('Table %s missing', tbl);
  END LOOP;

  -- task_tier CHECK constraint exists on llm_call_log
  ASSERT (SELECT COUNT(*) FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
      ON cc.constraint_name = ccu.constraint_name AND cc.constraint_schema = ccu.constraint_schema
    WHERE ccu.table_schema='public' AND ccu.table_name='llm_call_log'
      AND ccu.column_name='task_tier') >= 1,
    'llm_call_log.task_tier CHECK constraint missing';

  RAISE NOTICE 'validate/0009: OK';
END $$;

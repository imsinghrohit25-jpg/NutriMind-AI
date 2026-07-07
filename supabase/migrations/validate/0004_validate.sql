-- Validate 0004: Scanning tables
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='scans') = 1, 'scans table missing';
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='scan_images') = 1, 'scan_images table missing';

  ASSERT (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='scans' AND column_name='user_id') = 'NO',
    'scans.user_id must be NOT NULL';

  ASSERT (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='scan_images' AND column_name='storage_path') = 'NO',
    'scan_images.storage_path must be NOT NULL';

  RAISE NOTICE 'validate/0004: OK';
END $$;

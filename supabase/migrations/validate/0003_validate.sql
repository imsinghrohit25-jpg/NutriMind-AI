-- Validate 0003: Catalog tables, provenance NOT NULL, indexes
DO $$
DECLARE
  tbl TEXT;
  col TEXT;
  tables TEXT[] := ARRAY['data_sources','allergen_taxonomy','products','product_nutrition',
                          'product_ingredients','product_ingredient_items','ingredients'];
  -- Provenance columns that must be NOT NULL on all data-bearing tables
  provenance_checks TEXT[][] := ARRAY[
    ARRAY['products','source'],
    ARRAY['products','source_id'],
    ARRAY['products','dataset_version'],
    ARRAY['products','retrieved_at'],
    ARRAY['products','license_class'],
    ARRAY['product_nutrition','source'],
    ARRAY['product_nutrition','source_id'],
    ARRAY['product_nutrition','dataset_version'],
    ARRAY['product_nutrition','retrieved_at'],
    ARRAY['product_nutrition','license_class'],
    ARRAY['product_ingredients','source'],
    ARRAY['product_ingredients','source_id'],
    ARRAY['product_ingredients','dataset_version'],
    ARRAY['product_ingredients','retrieved_at'],
    ARRAY['product_ingredients','license_class'],
    ARRAY['ingredients','source'],
    ARRAY['ingredients','source_id'],
    ARRAY['ingredients','dataset_version'],
    ARRAY['ingredients','retrieved_at'],
    ARRAY['ingredients','license_class']
  ];
  pair TEXT[];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    ASSERT (
      SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_name=tbl
    ) = 1, format('Table %s missing', tbl);
  END LOOP;

  FOREACH pair SLICE 1 IN ARRAY provenance_checks LOOP
    ASSERT (
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name=pair[1] AND column_name=pair[2]
    ) = 'NO', format('provenance column %s.%s must be NOT NULL', pair[1], pair[2]);
  END LOOP;

  -- Verify trigram index on products.name
  ASSERT (
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='products' AND indexname='products_name_trgm_idx'
  ) = 1, 'products_name_trgm_idx missing';

  RAISE NOTICE 'validate/0003: OK';
END $$;

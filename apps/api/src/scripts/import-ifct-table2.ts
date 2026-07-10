// Real import script — IFCT 2017 Table 2 (Water-Soluble Vitamins) -> product_nutrition merge.
// ADR-0031 §5. Idempotent: merges into the SAME rows Table 1's import already created (by
// source_id) — never re-creates a product, never overwrites a field this table doesn't cover.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table2.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable2, runTable2SpotChecks, TABLE2_DEDICATED_FIELDS } from '../datasources/ifct/table2-water-vitamins.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 2 (Water-Soluble Vitamins)',
  reportSlug: 'ifct-table2',
  datasetFileName: 'table2_water_vitamins_raw.txt',
  parse: parseTable2,
  dedicatedFields: TABLE2_DEDICATED_FIELDS,
  spotChecks: runTable2SpotChecks,
}).catch((err) => {
  console.error('[ifct-table2] fatal error:', err);
  process.exitCode = 1;
});

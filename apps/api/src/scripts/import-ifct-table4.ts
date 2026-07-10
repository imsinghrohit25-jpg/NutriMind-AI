// Real import script — IFCT 2017 Table 4 (Carotenoids) -> product_nutrition merge.
// ADR-0031 §5. Idempotent: merges into the SAME rows Table 1's import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table4.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable4, runTable4SpotChecks, TABLE4_DEDICATED_FIELDS } from '../datasources/ifct/table4-carotenoids.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 4 (Carotenoids)',
  reportSlug: 'ifct-table4',
  datasetFileName: 'table4_carotenoids_raw.txt',
  parse: parseTable4,
  dedicatedFields: TABLE4_DEDICATED_FIELDS,
  spotChecks: runTable4SpotChecks,
  adrNote: 'Groups N/O/P/Q/R/S (animal-only foods) absent from this table entirely — real, expected: carotenoids are plant pigments.',
}).catch((err) => {
  console.error('[ifct-table4] fatal error:', err);
  process.exitCode = 1;
});

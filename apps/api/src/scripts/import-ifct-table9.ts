// Real import script — IFCT 2017 Table 9 (Organic Acids) -> product_nutrition merge.
// ADR-0031 §5. Idempotent: merges into the SAME rows Table 1's import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table9.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable9, runTable9SpotChecks, TABLE9_DEDICATED_FIELDS } from '../datasources/ifct/table9-organic-acids.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 9 (Organic Acids)',
  reportSlug: 'ifct-table9',
  datasetFileName: 'table9_organic_acids_raw.txt',
  parse: parseTable9,
  dedicatedFields: TABLE9_DEDICATED_FIELDS,
  spotChecks: runTable9SpotChecks,
}).catch((err) => {
  console.error('[ifct-table9] fatal error:', err);
  process.exitCode = 1;
});

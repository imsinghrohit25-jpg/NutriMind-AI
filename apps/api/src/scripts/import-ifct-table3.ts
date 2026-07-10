// Real import script — IFCT 2017 Table 3 (Fat-Soluble Vitamins) -> product_nutrition merge.
// ADR-0031 §5. Idempotent: merges into the SAME rows Table 1's import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table3.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable3, runTable3SpotChecks, TABLE3_DEDICATED_FIELDS } from '../datasources/ifct/table3-fat-vitamins.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 3 (Fat-Soluble Vitamins)',
  reportSlug: 'ifct-table3',
  datasetFileName: 'table3_fat_vitamins_raw.txt',
  parse: parseTable3,
  dedicatedFields: TABLE3_DEDICATED_FIELDS,
  spotChecks: runTable3SpotChecks,
  adrNote: 'Group L (Milk, 4 foods) rejected: real book footnote exception, see table3-fat-vitamins.ts.',
}).catch((err) => {
  console.error('[ifct-table3] fatal error:', err);
  process.exitCode = 1;
});

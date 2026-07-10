// Real import script — IFCT 2017 Table 6 (Starch and Individual Sugars) -> product_nutrition merge.
// ADR-0031 §5. Idempotent: merges into the SAME rows Table 1's import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table6.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable6, runTable6SpotChecks, TABLE6_DEDICATED_FIELDS } from '../datasources/ifct/table6-starch-sugars.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 6 (Starch and Individual Sugars)',
  reportSlug: 'ifct-table6',
  datasetFileName: 'table6_starch_sugars_raw.txt',
  parse: parseTable6,
  dedicatedFields: TABLE6_DEDICATED_FIELDS,
  spotChecks: runTable6SpotChecks,
  adrNote: 'Group L (Milk, 4 foods) rejected: real footnoted/garbled lactose section, see table6-starch-sugars.ts.',
}).catch((err) => {
  console.error('[ifct-table6] fatal error:', err);
  process.exitCode = 1;
});

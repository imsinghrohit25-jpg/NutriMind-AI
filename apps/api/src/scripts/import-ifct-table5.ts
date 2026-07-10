// Real import script — IFCT 2017 Table 5 (Minerals and Trace Elements) -> product_nutrition merge.
// ADR-0031 §5 (position-aware re-extraction). Idempotent: merges into the SAME rows Table 1's
// import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table5.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable5, runTable5SpotChecks, TABLE5_DEDICATED_FIELDS } from '../datasources/ifct/table5-minerals.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 5 (Minerals and Trace Elements)',
  reportSlug: 'ifct-table5',
  datasetFileName: 'table5_minerals_positional.txt',
  parse: parseTable5,
  dedicatedFields: TABLE5_DEDICATED_FIELDS,
  spotChecks: runTable5SpotChecks,
  adrNote: 'Position-aware re-extraction (pdftotext -table) — see ADR-0031 §5 addendum.',
}).catch((err) => {
  console.error('[ifct-table5] fatal error:', err);
  process.exitCode = 1;
});

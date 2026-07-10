// Real import script — IFCT 2017 Table 10 (Polyphenols) -> product_nutrition merge.
// ADR-0031 §5 (CSV-based re-extraction — see table10-polyphenols.ts for why). Idempotent: merges
// into the SAME rows Table 1's import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table10.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable10, runTable10SpotChecks, TABLE10_DEDICATED_FIELDS } from '../datasources/ifct/table10-polyphenols.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 10 (Polyphenols)',
  reportSlug: 'ifct-table10',
  datasetFileName: 'ifct2017_compositions.csv',
  parse: parseTable10,
  dedicatedFields: TABLE10_DEDICATED_FIELDS,
  spotChecks: runTable10SpotChecks,
  adrNote: 'CSV-based re-extraction (cross-validated against position-aware -table data) — see ADR-0031 §5 addendum. Group T (14 oils) orphaned here: no Table 1 proximate row exists for them.',
}).catch((err) => {
  console.error('[ifct-table10] fatal error:', err);
  process.exitCode = 1;
});

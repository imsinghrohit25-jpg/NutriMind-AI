// Real import script — IFCT 2017 Table 11 (Oligosaccharides, Phytosterols, Phytates & Saponins)
// -> product_nutrition merge. ADR-0031 §5 (CSV-based re-extraction). Idempotent: merges into the
// SAME rows Table 1's import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table11.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable11, runTable11SpotChecks, TABLE11_DEDICATED_FIELDS } from '../datasources/ifct/table11-oligo-phyto.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 11 (Oligosaccharides, Phytosterols, Phytates & Saponins)',
  reportSlug: 'ifct-table11',
  datasetFileName: 'ifct2017_compositions.csv',
  parse: parseTable11,
  dedicatedFields: TABLE11_DEDICATED_FIELDS,
  spotChecks: runTable11SpotChecks,
  adrNote: 'CSV-based re-extraction (cross-validated against position-aware -table data) — see ADR-0031 §5 addendum. Group T (14 oils) orphaned here: no Table 1 proximate row exists for them.',
}).catch((err) => {
  console.error('[ifct-table11] fatal error:', err);
  process.exitCode = 1;
});

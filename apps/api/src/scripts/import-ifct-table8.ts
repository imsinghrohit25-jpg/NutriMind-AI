// Real import script — IFCT 2017 Table 8 (Amino Acid Profile) -> product_nutrition merge.
// ADR-0031 §5 (position-aware re-extraction). Idempotent: merges into the SAME rows Table 1's
// import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table8.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable8, runTable8SpotChecks, TABLE8_DEDICATED_FIELDS } from '../datasources/ifct/table8-amino-acids.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

runTableMergeImport({
  tableLabel: 'Table 8 (Amino Acid Profile)',
  reportSlug: 'ifct-table8',
  datasetFileName: 'table8_amino_acids_positional.txt',
  parse: parseTable8,
  dedicatedFields: TABLE8_DEDICATED_FIELDS,
  spotChecks: runTable8SpotChecks,
  adrNote: 'Position-aware re-extraction (pdftotext -table) — see ADR-0031 §5 addendum.',
}).catch((err) => {
  console.error('[ifct-table8] fatal error:', err);
  process.exitCode = 1;
});

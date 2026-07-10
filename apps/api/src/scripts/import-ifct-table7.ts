// Real import script — IFCT 2017 Table 7 (Fatty Acid Profile) -> product_nutrition merge.
// ADR-0031 §5 (position-aware re-extraction). Idempotent: merges into the SAME rows Table 1's
// import already created.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table7.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable7, runTable7SpotChecks, withGramTotals, TABLE7_DEDICATED_FIELDS, type Table7Row } from '../datasources/ifct/table7-fatty-acids.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';

function parse(rawText: string): { rows: Table7Row[]; rejected: ReturnType<typeof parseTable7>['rejected'] } {
  const result = parseTable7(rawText);
  return { rows: result.rows.map(withGramTotals), rejected: result.rejected };
}

runTableMergeImport({
  tableLabel: 'Table 7 (Fatty Acid Profile)',
  reportSlug: 'ifct-table7',
  datasetFileName: 'table7_fatty_acids_positional.txt',
  parse,
  dedicatedFields: TABLE7_DEDICATED_FIELDS,
  spotChecks: runTable7SpotChecks,
  adrNote: 'Position-aware re-extraction (pdftotext -table) — see ADR-0031 §5 addendum.',
}).catch((err) => {
  console.error('[ifct-table7] fatal error:', err);
  process.exitCode = 1;
});

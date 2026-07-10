// Real import script — IFCT 2017 Table 1 (Proximates & Dietary Fibre) → products/product_nutrition.
// ADR-0031 §4 (stages 4-5: merge + report). Idempotent: safe to re-run, upserts on
// (source='ifct_2017', source_id=food_code) — the same real constraints products/product_nutrition
// already enforce (products_source_source_id_key, product_nutrition_product_uniq).
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table1.ts [--dataset-dir data/ifct2017] [--dry-run]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { IfctLoader } from '../datasources/ifct/loader.js';
import { persistProduct } from '../datasources/openfoodfacts/cache.js';
import { runTable1SpotChecks, type SpotCheckResult } from '../datasources/ifct/spot-check.js';
import type { Table1ImportReport } from '../datasources/ifct/parser.js';

const DATASET_DIR = process.argv.includes('--dataset-dir')
  ? process.argv[process.argv.indexOf('--dataset-dir') + 1]!
  : 'data/ifct2017';
const DRY_RUN = process.argv.includes('--dry-run');

// This file lives at apps/api/src/scripts/ — the repo's docs/ (where docs/adr/, docs/imports/
// already live) is three levels up from apps/api, regardless of the CWD the script is invoked from.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPORT_DIR = join(REPO_ROOT, 'docs/imports');

const DATABASE_URL = process.env.DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main(): Promise<void> {
  const loader = new IfctLoader();
  await loader.load(DATASET_DIR);

  if (!loader.isAvailable()) {
    console.error('[import-ifct-table1] dataset unavailable — cannot proceed. Run with the real');
    console.error('extracted table1_proximates_raw.txt present in the dataset directory.');
    process.exitCode = 1;
    return;
  }

  const report = loader.getImportReport()!;
  console.log('[import-ifct-table1] Parse + validation report:');
  console.log(`  total parsed:                ${report.totalParsed}`);
  console.log(`  rejected at parse:           ${report.totalRejectedAtParse}`);
  console.log(`  rejected at validation:      ${report.totalRejectedAtValidation}`);
  console.log(`  valid (importable):         ${report.totalValid}`);
  console.log(`  rows with warnings:          ${report.warnings.length}`);
  console.log(`  names requiring reassembly:  ${report.nameReconstructedCodes.length}`);

  if (report.parseRejections.length > 0) {
    console.log('\n  Parse rejections:');
    for (const r of report.parseRejections) console.log(`    [${r.foodCode ?? '?'}] ${r.reason}`);
  }
  if (report.validationRejections.length > 0) {
    console.log('\n  Validation rejections:');
    for (const r of report.validationRejections) console.log(`    [${r.foodCode}] ${r.reason}`);
  }
  if (report.nameReconstructedCodes.length > 0) {
    console.log('\n  Names reassembled from multi-line wraps (spot-check recommended):');
    for (const code of report.nameReconstructedCodes) {
      const entry = loader.findByCode(code);
      console.log(`    [${code}] "${entry?.foodNameEn}"`);
    }
  }

  const spotChecks = runTable1SpotChecks(loader);
  console.log('\n  Spot-check assertions against well-known foods (ADR-0031 §4 stage 5):');
  for (const r of spotChecks) {
    console.log(`    [${r.foodCode}] ${r.ok ? 'OK' : 'MISMATCH: ' + r.mismatches.join('; ')}`);
  }

  let imported: number | null = null;
  if (DRY_RUN) {
    console.log('\n[import-ifct-table1] --dry-run: no database writes performed.');
  } else {
    const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
    try {
      imported = 0;
      for (const entry of loader.getAll()) {
        const product = loader.toCanonicalProduct(entry);
        await persistProduct(sql, product);
        imported++;
      }
      console.log(`\n[import-ifct-table1] Imported/updated ${imported} products into products/product_nutrition.`);
    } finally {
      await sql.end();
    }
  }

  const reportPath = writeImportReport(report, spotChecks, imported);
  console.log(`\n[import-ifct-table1] Report written to ${reportPath}`);
}

function writeImportReport(
  report: Table1ImportReport,
  spotChecks: SpotCheckResult[],
  imported: number | null,
): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const reportPath = join(REPORT_DIR, `ifct-table1-${stamp}.md`);

  const lines: string[] = [];
  lines.push(`# IFCT 2017 Table 1 (Proximates & Dietary Fibre) — import report`);
  lines.push('');
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push(`ADR: docs/adr/ADR-0031-ifct-2017-real-source-integration.md`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- total parsed: ${report.totalParsed}`);
  lines.push(`- rejected at parse: ${report.totalRejectedAtParse}`);
  lines.push(`- rejected at validation: ${report.totalRejectedAtValidation}`);
  lines.push(`- valid (importable): ${report.totalValid}`);
  lines.push(`- rows with warnings: ${report.warnings.length}`);
  lines.push(`- names requiring reassembly: ${report.nameReconstructedCodes.length}`);
  lines.push(`- imported/updated into products/product_nutrition: ${imported === null ? 'N/A (--dry-run)' : imported}`);
  lines.push('');

  lines.push('## Spot-check assertions against well-known foods');
  lines.push('');
  lines.push('Reference values transcribed directly from the extracted book text (see `datasources/ifct/spot-check.ts`).');
  lines.push('');
  for (const r of spotChecks) {
    lines.push(`- [${r.foodCode}] ${r.ok ? 'OK' : `MISMATCH: ${r.mismatches.join('; ')}`}`);
  }
  lines.push('');

  if (report.parseRejections.length > 0) {
    lines.push('## Parse rejections');
    lines.push('');
    for (const r of report.parseRejections) lines.push(`- [${r.foodCode ?? '?'}] ${r.reason}`);
    lines.push('');
  }

  if (report.validationRejections.length > 0) {
    lines.push('## Validation rejections');
    lines.push('');
    for (const r of report.validationRejections) lines.push(`- [${r.foodCode}] ${r.reason}`);
    lines.push('');
  }

  if (report.nameReconstructedCodes.length > 0) {
    lines.push('## Names reassembled from multi-line wraps (spot-check recommended)');
    lines.push('');
    for (const code of report.nameReconstructedCodes) lines.push(`- ${code}`);
    lines.push('');
  }

  writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

main().catch((err) => {
  console.error('[import-ifct-table1] fatal error:', err);
  process.exitCode = 1;
});

// Shared merge-import runner — ADR-0031 §5 (Tables 2-12).
//
// Every table beyond Table 1 follows the same real pipeline: read this table's own sliced raw
// text, parse it (table-specific parser), look up the PRE-EXISTING product row Table 1's import
// already created (by source_id — a food absent from Table 1's 526 valid rows is a real, reported
// orphan, never silently skipped), fold this table's nutrients into it (never overwriting a field
// another table already populated), persist, and write a dated report to `docs/imports/`. This
// runner is the shared shape; each table's own script supplies only its parser, dataset filename,
// and dedicated-column map.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { getProductBySourceId, persistProduct } from '../openfoodfacts/cache.js';
import { mergeTableValuesIntoNutrition, type DedicatedFieldMap } from './nutrient-merge.js';
import type { SignatureParsedRow, RejectedRow } from './table-parsing.js';
import type { CanonicalProduct } from '../../nutrition/canonical-model.js';

export interface SpotCheckResult {
  foodCode: string;
  ok: boolean;
  mismatches: string[];
}

export interface TableMergeImportOptions<ColumnKey extends string> {
  /** Human-readable label for console/report output, e.g. "Table 2 (Water-Soluble Vitamins)". */
  tableLabel: string;
  /** Report filename stem, e.g. "ifct-table2" -> docs/imports/ifct-table2-<date>.md. */
  reportSlug: string;
  /** Raw-text filename inside the dataset directory, e.g. "table2_water_vitamins_raw.txt". */
  datasetFileName: string;
  parse: (rawText: string) => { rows: SignatureParsedRow<ColumnKey>[]; rejected: RejectedRow[] };
  dedicatedFields: DedicatedFieldMap<ColumnKey>;
  spotChecks?: (rows: SignatureParsedRow<ColumnKey>[]) => SpotCheckResult[];
  adrNote?: string;
  /** When a row's food code has no existing product (e.g. Table 12's Group T oils, which Table 1
   *  never created — they have no proximate data of their own, see ADR-0031 §1), builds a genuine
   *  new product instead of orphaning the row. Every other table leaves this unset and keeps the
   *  existing "orphan and report" behavior — a food absent from Table 1's valid set for THOSE
   *  tables is a real data gap, not something to fabricate a product for. */
  createIfMissing?: (row: SignatureParsedRow<ColumnKey>) => CanonicalProduct;
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const REPORT_DIR = join(REPO_ROOT, 'docs/imports');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function runTableMergeImport<ColumnKey extends string>(
  opts: TableMergeImportOptions<ColumnKey>,
): Promise<void> {
  const datasetDir = process.argv.includes('--dataset-dir')
    ? process.argv[process.argv.indexOf('--dataset-dir') + 1]!
    : 'data/ifct2017';
  const dryRun = process.argv.includes('--dry-run');

  const path = join(datasetDir, opts.datasetFileName);
  if (!existsSync(path)) {
    console.error(`[${opts.reportSlug}] dataset unavailable at ${path} — cannot proceed.`);
    process.exitCode = 1;
    return;
  }

  const rawText = readFileSync(path, 'utf8');
  const { rows, rejected } = opts.parse(rawText);

  console.log(`[${opts.reportSlug}] Parsed ${opts.tableLabel}:`);
  console.log(`  parsed rows:     ${rows.length}`);
  console.log(`  rejected:        ${rejected.length}`);
  if (rejected.length > 0) {
    console.log('\n  Rejections:');
    for (const r of rejected) console.log(`    [${r.foodCode ?? '?'}] ${r.reason}`);
  }

  const spotChecks = opts.spotChecks ? opts.spotChecks(rows) : [];
  if (spotChecks.length > 0) {
    console.log(`\n  Spot-check assertions against well-known foods:`);
    for (const r of spotChecks) {
      console.log(`    [${r.foodCode}] ${r.ok ? 'OK' : 'MISMATCH: ' + r.mismatches.join('; ')}`);
    }
  }

  let merged = 0;
  let created = 0;
  const orphaned: string[] = [];

  if (dryRun) {
    console.log(`\n[${opts.reportSlug}] --dry-run: no database writes performed.`);
    // Still need to know which rows WOULD be orphaned, for an accurate report.
    const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
    try {
      for (const row of rows) {
        const existing = await getProductBySourceId(sql, 'ifct_2017', row.foodCode);
        if ((!existing || !existing.nutrition) && !opts.createIfMissing) orphaned.push(row.foodCode);
      }
    } finally {
      await sql.end();
    }
  } else {
    const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
    try {
      for (const row of rows) {
        const existing = await getProductBySourceId(sql, 'ifct_2017', row.foodCode);
        if (!existing || !existing.nutrition) {
          if (opts.createIfMissing) {
            const fresh = opts.createIfMissing(row);
            const mergedNutrition = fresh.nutrition
              ? mergeTableValuesIntoNutrition(fresh.nutrition, row.values, opts.dedicatedFields)
              : null;
            await persistProduct(sql, { ...fresh, nutrition: mergedNutrition });
            created++;
            continue;
          }
          orphaned.push(row.foodCode);
          continue;
        }
        const mergedNutrition = mergeTableValuesIntoNutrition(existing.nutrition, row.values, opts.dedicatedFields);
        await persistProduct(sql, { ...existing, nutrition: mergedNutrition });
        merged++;
      }
      console.log(`\n[${opts.reportSlug}] Merged ${merged} rows into existing products/product_nutrition rows.`);
      if (created > 0) console.log(`  Created ${created} new products (no Table 1 row existed for them).`);
      if (orphaned.length > 0) {
        console.log(`  ${orphaned.length} rows had no matching Table 1 product (never persisted): ${orphaned.join(', ')}`);
      }
    } finally {
      await sql.end();
    }
  }

  const reportPath = writeReport(opts, rows.length, rejected, spotChecks, merged, created, orphaned, dryRun);
  console.log(`\n[${opts.reportSlug}] Report written to ${reportPath}`);
}

function writeReport<ColumnKey extends string>(
  opts: TableMergeImportOptions<ColumnKey>,
  parsedCount: number,
  rejected: RejectedRow[],
  spotChecks: SpotCheckResult[],
  merged: number,
  created: number,
  orphaned: string[],
  dryRun: boolean,
): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const reportPath = join(REPORT_DIR, `${opts.reportSlug}-${stamp}.md`);

  const lines: string[] = [];
  lines.push(`# IFCT 2017 ${opts.tableLabel} — import report`);
  lines.push('');
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push(`ADR: docs/adr/ADR-0031-ifct-2017-real-source-integration.md`);
  if (opts.adrNote) lines.push(opts.adrNote);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- rows parsed: ${parsedCount}`);
  lines.push(`- rejected at parse: ${rejected.length}`);
  lines.push(`- merged into existing products/product_nutrition rows: ${dryRun ? 'N/A (--dry-run)' : merged}`);
  if (created > 0 || opts.createIfMissing) lines.push(`- new products created (no Table 1 row existed): ${dryRun ? 'N/A (--dry-run)' : created}`);
  lines.push(`- orphaned (no matching Table 1 product): ${orphaned.length}`);
  lines.push('');

  if (spotChecks.length > 0) {
    lines.push('## Spot-check assertions against well-known foods');
    lines.push('');
    for (const r of spotChecks) lines.push(`- [${r.foodCode}] ${r.ok ? 'OK' : `MISMATCH: ${r.mismatches.join('; ')}`}`);
    lines.push('');
  }

  if (rejected.length > 0) {
    lines.push('## Parse rejections');
    lines.push('');
    for (const r of rejected) lines.push(`- [${r.foodCode ?? '?'}] ${r.reason}`);
    lines.push('');
  }

  if (orphaned.length > 0) {
    lines.push('## Orphaned rows (present in this table, absent from Table 1s valid set)');
    lines.push('');
    for (const code of orphaned) lines.push(`- ${code}`);
    lines.push('');
  }

  writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

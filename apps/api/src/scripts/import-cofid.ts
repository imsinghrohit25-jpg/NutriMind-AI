// Real import script — UK CoFID 2021 -> products/product_nutrition/food_groups. ADR-0033.
//
// STRICTLY ADDITIVE: every CoFID food becomes a brand-new, independent product row (source=
// 'cofid_2021') — never merged into an existing USDA/IFCT/CNF product identity, per the master
// prompt's own §5 guidance ("a false split is safe; a false merge corrupts data"). The ENTIRE
// import runs inside one Postgres transaction: on ANY failure (a thrown error at any stage), the
// transaction rolls back automatically and NO partial CoFID data is left committed — verified by
// a dedicated rollback drill (see docs/imports/ for the report).
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-cofid.ts [--file data/cofid/cofid_2021.xlsx] [--dry-run] [--inject-failure-at=<foodCode>]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { findMissingCofidFile, loadCofidDataset } from '../datasources/cofid/xlsx-loader.js';
import { validateCofidDataset } from '../datasources/cofid/validate.js';
import { normalizeCofidFood, COFID_SOURCE_ID } from '../datasources/cofid/normalize.js';
import { persistProduct } from '../datasources/openfoodfacts/cache.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPORT_DIR = join(REPO_ROOT, 'docs/imports');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main(): Promise<void> {
  const filePath = process.argv.includes('--file')
    ? process.argv[process.argv.indexOf('--file') + 1]!
    : 'data/cofid/cofid_2021.xlsx';
  const dryRun = process.argv.includes('--dry-run');
  const injectFailureArg = process.argv.find((a) => a.startsWith('--inject-failure-at='));
  const injectFailureAt = injectFailureArg ? injectFailureArg.split('=')[1] : null;

  // ── GATE 0: dataset availability ──────────────────────────────────────────────────────────
  const missing = findMissingCofidFile(filePath);
  if (missing) {
    console.error('[cofid-import] REQUIRED FILE missing — cannot proceed:');
    console.error(`  - ${missing}`);
    console.error('\nPlace the official Public Health England / OHID CoFID 2021 Excel workbook at that path.');
    console.error('Resume with: npx tsx src/scripts/import-cofid.ts');
    process.exitCode = 1;
    return;
  }

  console.log('[cofid-import] Loading CoFID workbook (1.3 Proximates, 1.4 Inorganics, 1.5 Vitamins, 1.6 Vitamin Fractions)...');
  const dataset = await loadCofidDataset(filePath);
  console.log(`[cofid-import]   ${dataset.foods.length} foods, checksum ${dataset.checksum}`);

  console.log('[cofid-import] Validating (referential integrity hard-gate; proximate/Atwater informational)...');
  const validation = validateCofidDataset(dataset);
  console.log(`[cofid-import]   valid: ${validation.validFoodCodes.size}, rejected: ${validation.rejections.length}, warnings: ${validation.warnings.length}`);
  console.log(`[cofid-import]   symbol tally: ${JSON.stringify(validation.symbolTally)}`);

  const groupCodes = new Set(dataset.foods.map((f) => f.groupCode).filter(Boolean));

  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  let batchId: string | null = null;
  let importedFoods = 0;
  let importedGroups = 0;
  let failureReason: string | null = null;

  try {
    if (!dryRun) {
      const [batch] = await sql<{ id: string }[]>`
        INSERT INTO public.import_batches (source, dataset_version, status, file_checksums, rows_parsed)
        VALUES (${COFID_SOURCE_ID}, ${dataset.datasetVersion}, 'running', ${sql.json({ workbook: dataset.checksum })}, ${dataset.foods.length})
        RETURNING id
      `;
      batchId = batch!.id;
      console.log(`[cofid-import] Batch ${batchId} started.`);

      await sql.begin(async (tx) => {
        // `tx` is postgres.js's TransactionSql — a structural superset of the Sql type persistProduct
        // declares (it lacks only pool-management members like END/CLOSE, never called here); cast
        // rather than widening that function's own parameter type, since it's shared, already-tested
        // code used by every other source (extend, don't modify).
        const txSql = tx as unknown as postgres.Sql;

        // Food groups — CoFID's own 121-code taxonomy has no group-name lookup sheet in this
        // workbook edition (verified: "List of tables" is a table of contents, not a dictionary) —
        // the raw code is used as both code and display_name rather than fabricate label text from
        // memory not present in the verified source file (ADR-0033). Requires the (source, code)
        // composite PK fixed in migration 0032 — CoFID's single-letter codes (A, D, F, G, H, J, P,
        // Q, S) would otherwise collide with IFCT's own single-letter codes.
        for (const code of groupCodes) {
          await tx`
            INSERT INTO public.food_groups (source, code, display_name, food_entry_count)
            VALUES (${COFID_SOURCE_ID}, ${code}, ${code}, NULL)
            ON CONFLICT (source, code) DO NOTHING
          `;
          importedGroups++;
        }

        // A duplicate Food Code (real, found in the official 2021 workbook: 13-669 is used for
        // both "Aubergine, roasted" and "Watercress, raw") is only rejected at the CODE level by
        // validate.ts — `validFoodCodes` is a Set, so a naive `.has(food.foodCode)` check here
        // would let BOTH rows through, and the later one would silently win via persistProduct's
        // upsert (found by inspecting the persisted row directly, not assumed). Track processed
        // codes here too so the FIRST occurrence is the one actually imported, matching validate.ts's
        // own "reject later occurrence" semantics and the master prompt's explicit requirement.
        const processedCodes = new Set<string>();
        for (const food of dataset.foods) {
          if (!validation.validFoodCodes.has(food.foodCode)) continue;
          if (processedCodes.has(food.foodCode)) continue;
          processedCodes.add(food.foodCode);

          if (injectFailureAt !== null && food.foodCode === injectFailureAt) {
            throw new Error(`[rollback drill] deliberately injected failure at Food Code ${injectFailureAt}`);
          }

          const product = normalizeCofidFood(food, dataset);
          await persistProduct(txSql, product);
          importedFoods++;
        }
      });

      await sql`
        UPDATE public.import_batches
        SET status = 'completed', rows_imported = ${importedFoods}, rows_rejected = ${validation.rejections.length}, completed_at = now()
        WHERE id = ${batchId}
      `;
      console.log(`[cofid-import] Batch ${batchId} completed: ${importedFoods} foods, ${importedGroups} food groups.`);
    } else {
      console.log('[cofid-import] --dry-run: no database writes performed.');
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : String(err);
    console.error(`[cofid-import] FAILURE — transaction rolled back automatically. Reason: ${failureReason}`);
    if (batchId) {
      await sql`
        UPDATE public.import_batches
        SET status = 'rolled_back', error_message = ${failureReason}, completed_at = now()
        WHERE id = ${batchId}
      `;
    }
    // Post-rollback invariant check: zero CoFID rows should remain from this failed batch.
    const countRows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM public.products WHERE source = ${COFID_SOURCE_ID}
    `;
    const count = countRows[0]?.count ?? '?';
    console.error(`[cofid-import] Post-rollback invariant check: ${count} CoFID product rows exist (should be 0 for a first-ever failed run).`);
  } finally {
    await sql.end();
  }

  const reportPath = writeReport({
    filePath, dryRun, dataset, validation,
    importedFoods, importedGroups,
    failureReason, batchId,
  });
  console.log(`\n[cofid-import] Report written to ${reportPath}`);
  if (failureReason) process.exitCode = 1;
}

function writeReport(args: {
  filePath: string;
  dryRun: boolean;
  dataset: Awaited<ReturnType<typeof loadCofidDataset>>;
  validation: ReturnType<typeof validateCofidDataset>;
  importedFoods: number;
  importedGroups: number;
  failureReason: string | null;
  batchId: string | null;
}): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const reportPath = join(REPORT_DIR, `cofid-2021-import-${stamp}.md`);

  const lines: string[] = [];
  lines.push('# UK CoFID 2021 — import report');
  lines.push('');
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push(`ADR: docs/adr/ADR-0033-cofid-2021-integration.md`);
  lines.push(`Batch ID: ${args.batchId ?? 'N/A (dry-run)'}`);
  lines.push('');
  lines.push('## Source file');
  lines.push('');
  lines.push(`- ${args.filePath}: SHA-256 \`${args.dataset.checksum}\``);
  lines.push('');
  lines.push('## Sheets imported');
  lines.push('');
  lines.push('- 1.3 Proximates (primary identity + macros/energy/fibre/fatty-acid-category totals/cholesterol)');
  lines.push('- 1.4 Inorganics (minerals)');
  lines.push('- 1.5 Vitamins');
  lines.push('- 1.6 Vitamin Fractions');
  lines.push('');
  lines.push('Deferred (see ADR-0033): 1.2 Factors, 1.7-1.12 (fatty-acid sub-breakdowns), 1.13 Phytosterols, 1.14 Organic Acids.');
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- foods parsed: ${args.dataset.foods.length}`);
  lines.push(`- foods valid (referential integrity passed): ${args.validation.validFoodCodes.size}`);
  lines.push(`- foods rejected: ${args.validation.rejections.length}`);
  lines.push(`- informational warnings (proximate/Atwater, non-blocking): ${args.validation.warnings.length}`);
  lines.push(`- foods imported: ${args.dryRun ? 'N/A (--dry-run)' : args.importedFoods}`);
  lines.push(`- food groups registered: ${args.dryRun ? 'N/A (--dry-run)' : args.importedGroups}`);
  lines.push('');
  lines.push('## Symbol tally (every raw nutrient cell across all valid foods)');
  lines.push('');
  for (const [symbol, count] of Object.entries(args.validation.symbolTally)) {
    lines.push(`- ${symbol}: ${count}`);
  }
  lines.push('');

  if (args.failureReason) {
    lines.push('## FAILURE — transaction rolled back');
    lines.push('');
    lines.push(`\`${args.failureReason}\``);
    lines.push('');
  }

  if (args.validation.rejections.length > 0) {
    lines.push('## Rejections (referential integrity)');
    lines.push('');
    for (const r of args.validation.rejections) lines.push(`- [${r.foodCode}] ${r.reason}`);
    lines.push('');
  }

  if (args.validation.warnings.length > 0) {
    lines.push('## Informational warnings (proximate/Atwater plausibility — not rejected)');
    lines.push('');
    lines.push(`${args.validation.warnings.length} total. First 50 shown:`);
    lines.push('');
    for (const w of args.validation.warnings.slice(0, 50)) lines.push(`- [${w.foodCode}] ${w.reason}`);
    lines.push('');
  }

  writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

main().catch((err) => {
  console.error('[cofid-import] fatal error:', err);
  process.exitCode = 1;
});

// Real import script — Canadian Nutrient File (CNF) 2026 -> products/product_nutrition/
// product_portions/product_aliases/food_groups. ADR-0032.
//
// STRICTLY ADDITIVE: every CNF food becomes a brand-new, independent product row (source=
// 'cnf_2026') — never merged into an existing USDA/IFCT product identity (see persist.ts's own
// header comment for why). The ENTIRE import runs inside one Postgres transaction: on ANY failure
// (a thrown error at any stage), the transaction rolls back automatically and NO partial CNF data
// is left committed — verified by a dedicated rollback drill (see docs/imports/ for the report).
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-cnf.ts [--dataset-dir data/cnf] [--dry-run] [--inject-failure-at=<foodCode>]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { findMissingCnfFiles, loadCnfDataset } from '../datasources/cnf/loader.js';
import { validateCnfDataset } from '../datasources/cnf/validate.js';
import { normalizeCnfFood, CNF_SOURCE_ID } from '../datasources/cnf/normalize.js';
import { persistCnfPortions, persistCnfAliases } from '../datasources/cnf/persist.js';
import { persistProduct } from '../datasources/openfoodfacts/cache.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPORT_DIR = join(REPO_ROOT, 'docs/imports');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main(): Promise<void> {
  const datasetDir = process.argv.includes('--dataset-dir')
    ? process.argv[process.argv.indexOf('--dataset-dir') + 1]!
    : 'data/cnf';
  const dryRun = process.argv.includes('--dry-run');
  const injectFailureArg = process.argv.find((a) => a.startsWith('--inject-failure-at='));
  const injectFailureAt = injectFailureArg ? injectFailureArg.split('=')[1] : null;

  // ── GATE 0: dataset availability ──────────────────────────────────────────────────────────
  const missing = findMissingCnfFiles(datasetDir);
  if (missing.length > 0) {
    console.error('[cnf-import] REQUIRED FILES missing — cannot proceed:');
    for (const f of missing) console.error(`  - ${f}`);
    console.error(`\nPlace the official Health Canada CNF distribution files in: ${datasetDir}`);
    console.error('Resume with: npx tsx src/scripts/import-cnf.ts');
    process.exitCode = 1;
    return;
  }

  console.log('[cnf-import] Loading CNF dataset...');
  const dataset = await loadCnfDataset(datasetDir);
  console.log(`[cnf-import]   ${dataset.foods.length} foods, ${dataset.nutrientNames.size} nutrients, ${dataset.measureNames.size} measures`);

  console.log('[cnf-import] Validating (referential integrity hard-gate; proximate/Atwater informational)...');
  const validation = validateCnfDataset(dataset);
  console.log(`[cnf-import]   valid: ${validation.validFoodCodes.size}, rejected: ${validation.rejections.length}, warnings: ${validation.warnings.length}`);

  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  let batchId: string | null = null;
  let importedFoods = 0;
  let importedPortions = 0;
  let importedAliases = 0;
  let importedGroups = 0;
  let failureReason: string | null = null;

  try {
    if (!dryRun) {
      const [batch] = await sql<{ id: string }[]>`
        INSERT INTO public.import_batches (source, dataset_version, status, file_checksums, rows_parsed)
        VALUES (${CNF_SOURCE_ID}, '2026', 'running', ${sql.json(dataset.fileChecksums)}, ${dataset.foods.length})
        RETURNING id
      `;
      batchId = batch!.id;
      console.log(`[cnf-import] Batch ${batchId} started.`);

      await sql.begin(async (tx) => {
        // `tx` is postgres.js's TransactionSql — a structural superset of the Sql type persistProduct
        // et al. declare (it lacks only pool-management members like END/CLOSE, never called here);
        // cast rather than widening those functions' own parameter types, since they're shared,
        // already-tested code used elsewhere with a real Sql instance (extend, don't modify).
        const txSql = tx as unknown as postgres.Sql;

        // Food groups — reuses the existing food_groups table (IFCT already established it; CNF's
        // numeric codes never collide with IFCT's single-letter codes).
        for (const g of dataset.foodGroups.values()) {
          await tx`
            INSERT INTO public.food_groups (code, display_name, source, food_entry_count)
            VALUES (${g.code}, ${g.nameEn}, ${CNF_SOURCE_ID}, NULL)
            ON CONFLICT (code) DO NOTHING
          `;
          importedGroups++;
        }

        for (const food of dataset.foods) {
          if (!validation.validFoodCodes.has(food.foodCode)) continue;

          if (injectFailureAt !== null && food.foodCode === injectFailureAt) {
            throw new Error(`[rollback drill] deliberately injected failure at Food_Code ${injectFailureAt}`);
          }

          const normalized = normalizeCnfFood(food, dataset);
          const productId = await persistProduct(txSql, normalized.product);
          importedFoods++;

          await persistCnfPortions(txSql, productId, normalized.portions);
          importedPortions += normalized.portions.length;

          await persistCnfAliases(txSql, productId, normalized.aliases);
          importedAliases += normalized.aliases.length;
        }
      });

      await sql`
        UPDATE public.import_batches
        SET status = 'completed', rows_imported = ${importedFoods}, rows_rejected = ${validation.rejections.length}, completed_at = now()
        WHERE id = ${batchId}
      `;
      console.log(`[cnf-import] Batch ${batchId} completed: ${importedFoods} foods, ${importedPortions} portions, ${importedAliases} aliases, ${importedGroups} food groups.`);
    } else {
      console.log('[cnf-import] --dry-run: no database writes performed.');
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : String(err);
    console.error(`[cnf-import] FAILURE — transaction rolled back automatically. Reason: ${failureReason}`);
    if (batchId) {
      await sql`
        UPDATE public.import_batches
        SET status = 'rolled_back', error_message = ${failureReason}, completed_at = now()
        WHERE id = ${batchId}
      `;
    }
    // Post-rollback invariant check: zero CNF rows should remain from this failed batch.
    const countRows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM public.products WHERE source = ${CNF_SOURCE_ID}
    `;
    const count = countRows[0]?.count ?? '?';
    console.error(`[cnf-import] Post-rollback invariant check: ${count} CNF product rows exist (should be 0 for a first-ever failed run).`);
  } finally {
    await sql.end();
  }

  const reportPath = writeReport({
    datasetDir, dryRun, dataset, validation,
    importedFoods, importedPortions, importedAliases, importedGroups,
    failureReason, batchId,
  });
  console.log(`\n[cnf-import] Report written to ${reportPath}`);
  if (failureReason) process.exitCode = 1;
}

function writeReport(args: {
  datasetDir: string;
  dryRun: boolean;
  dataset: Awaited<ReturnType<typeof loadCnfDataset>>;
  validation: ReturnType<typeof validateCnfDataset>;
  importedFoods: number;
  importedPortions: number;
  importedAliases: number;
  importedGroups: number;
  failureReason: string | null;
  batchId: string | null;
}): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const reportPath = join(REPORT_DIR, `cnf-2026-import-${stamp}.md`);

  const lines: string[] = [];
  lines.push('# Canadian Nutrient File (CNF) 2026 — import report');
  lines.push('');
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push(`ADR: docs/adr/ADR-0032-cnf-2026-integration.md`);
  lines.push(`Batch ID: ${args.batchId ?? 'N/A (dry-run)'}`);
  lines.push('');
  lines.push('## Source files + checksums (SHA-256)');
  lines.push('');
  for (const [file, hash] of Object.entries(args.dataset.fileChecksums)) lines.push(`- ${file}: \`${hash}\``);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- foods parsed: ${args.dataset.foods.length}`);
  lines.push(`- foods valid (referential integrity passed): ${args.validation.validFoodCodes.size}`);
  lines.push(`- foods rejected: ${args.validation.rejections.length}`);
  lines.push(`- informational warnings (proximate/Atwater, non-blocking): ${args.validation.warnings.length}`);
  lines.push(`- foods imported: ${args.dryRun ? 'N/A (--dry-run)' : args.importedFoods}`);
  lines.push(`- portions imported: ${args.dryRun ? 'N/A (--dry-run)' : args.importedPortions}`);
  lines.push(`- aliases imported (French names, alternates, scientific names): ${args.dryRun ? 'N/A (--dry-run)' : args.importedAliases}`);
  lines.push(`- food groups registered: ${args.dryRun ? 'N/A (--dry-run)' : args.importedGroups}`);
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
  console.error('[cnf-import] fatal error:', err);
  process.exitCode = 1;
});

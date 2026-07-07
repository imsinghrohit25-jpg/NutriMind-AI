#!/usr/bin/env tsx
// Phase 3 integration test — real API calls, no DB required.
// Gate: barcode resolution pipeline works end-to-end with provenance;
//       USDA FDC key verified; not-found path tested.
// Run: tsx scripts/integration-test-phase3.ts

import 'dotenv/config';
import { OpenFoodFactsClient, type OFFProduct } from '../apps/api/src/datasources/openfoodfacts/client.js';
import { normalizeOffProduct } from '../apps/api/src/datasources/openfoodfacts/normalize.js';
import { UsdaFdcClient } from '../apps/api/src/datasources/usda/client.js';
import { normalizeUsdaFood } from '../apps/api/src/datasources/usda/normalize.js';

const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

let passed = 0;
let failed = 0;

function ok(label: string, note = '') {
  console.log(`${GREEN}  ✓${RESET} ${label}${note ? `  ${YELLOW}${note}${RESET}` : ''}`);
  passed++;
}

function fail(label: string, reason: string) {
  console.log(`${RED}  ✗ ${label}${RESET}`);
  console.log(`    ${RED}${reason}${RESET}`);
  failed++;
}

function checkProvenance(product: ReturnType<typeof normalizeOffProduct>, label: string) {
  const missing: string[] = [];
  if (!product.source)         missing.push('source');
  if (!product.sourceId)       missing.push('sourceId');
  if (!product.datasetVersion) missing.push('datasetVersion');
  if (!product.retrievedAt)    missing.push('retrievedAt');
  if (!product.licenseClass)   missing.push('licenseClass');
  if (!product.name)           missing.push('name');
  if (missing.length) {
    fail(label, `missing provenance: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// ─── OFF tests ────────────────────────────────────────────────────────────────
async function runOFFTests(off: OpenFoodFactsClient): Promise<void> {
  console.log('\n── OpenFoodFacts: search India catalogue ────────────────────────────────────');

  // Step 1: Search for Indian products to discover live barcodes (avoids hardcoding)
  let searchResults: OFFProduct[] = [];
  try {
    searchResults = await off.searchByName('', 'en:india');
    if (!searchResults.length) {
      // Fallback: search without country filter
      searchResults = await off.searchByName('biscuit');
    }
    ok(`OFF search returned ${searchResults.length} results`);
  } catch (err) {
    fail('OFF search', err instanceof Error ? err.message : String(err));
  }

  // Step 2: Extract up to 10 barcodes from search results
  const barcodes = searchResults
    .map(p => p._id)
    .filter(id => id && /^\d{6,}$/.test(id))
    .slice(0, 10);

  console.log(`\n── OFF barcode round-trip: ${barcodes.length} products from search ────────────`);

  if (barcodes.length === 0) {
    fail('OFF barcode round-trip', 'No barcodes found in search results — cannot verify round-trip');
  } else {
    let roundTripPassed = 0;
    for (const barcode of barcodes) {
      try {
        const raw = await off.getProduct(barcode);
        if (!raw) {
          console.log(`${YELLOW}  ~ ${barcode} → null (in search but 404 on direct lookup)${RESET}`);
          continue;
        }
        const product = normalizeOffProduct(raw);
        if (checkProvenance(product, `${barcode} provenance`)) {
          ok(`${barcode} — ${product.name.slice(0, 40)}`, `src=${product.source} ver=${product.datasetVersion}`);
          roundTripPassed++;
        }
      } catch (err) {
        fail(`${barcode}`, err instanceof Error ? err.message : String(err));
      }
    }

    if (roundTripPassed >= Math.min(7, barcodes.length)) {
      ok(`${roundTripPassed}/${barcodes.length} products passed provenance check`);
    } else {
      fail(`Provenance check`, `Only ${roundTripPassed}/${barcodes.length} passed`);
    }
  }

  // Step 3: Not-found path
  console.log('\n── Not-found path ─────────────────────────────────────────────────────────');
  try {
    const raw = await off.getProduct('0000000000000');
    if (raw === null) {
      ok('0000000000000 → null (correct not-found behaviour)');
    } else {
      fail('Not-found barcode', 'Expected null, got a product');
    }
  } catch (err) {
    fail('Not-found path', err instanceof Error ? err.message : String(err));
  }

  // Step 4: Verify normalisation produces all required fields on a real product
  if (searchResults.length > 0) {
    console.log('\n── OFF normalisation: nutrition + added-sugar estimation ───────────────────');
    const sample = searchResults.find(p => p.nutriments && Object.keys(p.nutriments).length > 3);
    if (sample) {
      const product = normalizeOffProduct(sample);
      const n = product.nutrition;
      if (n) {
        const hasEstimation = n.sugarsAddedEstimated !== undefined;
        if (hasEstimation) {
          ok(`${sample._id} — added-sugar estimated=${n.sugarsAddedEstimated} (ADR-0007)`);
        } else {
          fail('Added-sugar estimation flag', 'sugarsAddedEstimated undefined');
        }
        if (product.licenseClass === 'odbl') {
          ok('License class = odbl (ODbL compliance)');
        } else {
          fail('License class', `expected odbl, got ${product.licenseClass}`);
        }
      } else {
        console.log(`${YELLOW}  ~ sample product has no nutriments — skipping nutrition check${RESET}`);
      }
    }
  }
}

// ─── USDA tests ───────────────────────────────────────────────────────────────
async function runUsdaTests(usda: UsdaFdcClient): Promise<void> {
  console.log('\n── USDA FDC: API key + reference food lookup ───────────────────────────────');

  const KNOWN_IDS: [string, number][] = [
    ['Broccoli raw (FDC 170379)', 170379],
    ['Wheat flour AP (FDC 169761)', 169761],
  ];

  for (const [label, fdcId] of KNOWN_IDS) {
    try {
      const food = await usda.getFoodById(fdcId);
      if (!food) { fail(label, 'returned null'); continue; }
      const product = normalizeUsdaFood(food);
      if (!product.source || !product.sourceId || !product.licenseClass || !product.nutrition?.energyKcal) {
        fail(label, 'missing provenance or energyKcal');
      } else {
        ok(`${label} → "${product.name.slice(0, 35)}" ${product.nutrition.energyKcal} kcal/100g`, `src=${product.source}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fail(label, msg.includes('403') || msg.includes('401') ? `Auth error — bad key? ${msg}` : msg);
    }
  }

  // Name search
  try {
    const r = await usda.searchFoods('lentils', ['Foundation', 'SR Legacy'], 5);
    if (r.length > 0) {
      ok(`USDA name search "lentils" → ${r.length} results`);
    } else {
      fail('USDA name search', '0 results for "lentils"');
    }
  } catch (err) {
    fail('USDA name search', err instanceof Error ? err.message : String(err));
  }

  // Provenance on a real USDA food
  try {
    const food = await usda.getFoodById(170379);
    if (food) {
      const p = normalizeUsdaFood(food);
      if (p.source === 'usda_fdc' && p.licenseClass === 'public_domain') {
        ok('USDA provenance: source=usda_fdc, licenseClass=public_domain');
      } else {
        fail('USDA provenance', `source=${p.source} licenseClass=${p.licenseClass}`);
      }
      if (p.nutrition?.sugarsAddedEstimated === true) {
        ok('USDA added-sugar estimated=true (ADR-0007, USDA has no added-sugar field)');
      } else {
        fail('USDA added-sugar estimation', `expected true, got ${p.nutrition?.sugarsAddedEstimated}`);
      }
    }
  } catch (err) {
    fail('USDA provenance check', err instanceof Error ? err.message : String(err));
  }
}

async function main(): Promise<void> {
  console.log('Phase 3 integration test — real APIs, no DB');
  console.log('─'.repeat(60));

  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) {
    console.error(`${RED}FATAL: USDA_FDC_API_KEY not set in .env${RESET}`);
    process.exit(1);
  }
  console.log(`USDA_FDC_API_KEY: set (length=${apiKey.length}) ✓`);

  const off  = new OpenFoodFactsClient(
    process.env.OFF_BASE_URL ?? 'https://world.openfoodfacts.org',
    process.env.OFF_USER_AGENT ?? 'NutriMindAI/0.1 (contact: imsinghrohit25@gmail.com)',
  );
  const usda = new UsdaFdcClient(apiKey);

  await runOFFTests(off);
  await runUsdaTests(usda);

  console.log('\n' + '─'.repeat(60));
  if (failed === 0) {
    console.log(`${GREEN}Phase 3 integration PASSED — ${passed}/${passed + failed} checks${RESET}`);
  } else {
    console.log(`${RED}Phase 3 integration FAILED — ${failed}/${passed + failed} checks failed${RESET}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

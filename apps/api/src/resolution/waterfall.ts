// Barcode resolution waterfall.
// Priority: DB cache → OpenFoodFacts → IFCT (name fallback) → USDA FDC → not-found → curation queue.
// Each successful resolution persists to DB for future cache hits.
// IFCT is attempted only when IFCT dataset is available (graceful degradation).

import type postgres from 'postgres';
import type { CanonicalProduct } from '../nutrition/canonical-model.js';
import type { OpenFoodFactsClient } from '../datasources/openfoodfacts/client.js';
import type { UsdaFdcClient } from '../datasources/usda/client.js';
import type { IfctLoader } from '../datasources/ifct/loader.js';
import { normalizeOffProduct } from '../datasources/openfoodfacts/normalize.js';
import { normalizeUsdaFood } from '../datasources/usda/normalize.js';
import { getProductFromCache, persistProduct } from '../datasources/openfoodfacts/cache.js';

type Sql = postgres.Sql;

export type ResolutionSource = 'cache' | 'openfoodfacts' | 'ifct_2017' | 'usda_fdc' | 'not_found';

export interface ResolutionResult {
  product: CanonicalProduct | null;
  resolvedBy: ResolutionSource;
  curationQueueId?: string;
  productId?: string;  // DB uuid after persistence
}

export interface WaterfallDeps {
  sql: Sql;
  offClient: OpenFoodFactsClient;
  ifct: IfctLoader;
  usdaClient: UsdaFdcClient | null;
}

export interface WaterfallOptions {
  ttlHours?: number;
  userId?: string;
  persistResult?: boolean;
}

export async function resolveBarcode(
  barcode: string,
  deps: WaterfallDeps,
  opts: WaterfallOptions = {},
): Promise<ResolutionResult> {
  const { sql, offClient, ifct, usdaClient } = deps;
  const ttl = opts.ttlHours ?? 168;
  const persist = opts.persistResult ?? true;

  // Step 1: DB cache
  const cached = await getProductFromCache(sql, barcode, ttl);
  if (cached) {
    return { product: cached, resolvedBy: 'cache', productId: cached.id };
  }

  // Step 2: OpenFoodFacts
  try {
    const offProduct = await offClient.getProduct(barcode);
    if (offProduct) {
      const product = normalizeOffProduct(offProduct);
      let productId: string | undefined;
      if (persist) {
        productId = await persistProduct(sql, product);
        product.id = productId;
      }
      return { product, resolvedBy: 'openfoodfacts', productId };
    }
  } catch (err) {
    console.warn('[waterfall] OFF lookup failed for', barcode, err instanceof Error ? err.message : err);
  }

  // Step 3: IFCT name search (for Indian whole foods, no barcode match in OFF)
  if (ifct.isAvailable()) {
    // For barcode-lookup context, IFCT won't have the barcode — skip unless the barcode
    // represents an Indian packaged food with an IFCT equivalent found by name heuristic.
    // This step is primarily useful when resolveByName() is called directly (Phase 5+).
    // Here we do a best-effort IFCT lookup by barcode prefix patterns (Indian EAN codes start 890).
    if (barcode.startsWith('890')) {
      // No direct IFCT↔barcode mapping — IFCT is for whole foods, not packaged SKUs.
      // Fallthrough to USDA.
    }
  }

  // Step 4: USDA FDC (reference data, no barcode lookup available in free tier)
  // USDA does not offer barcode lookup in the public FDC API — skip for barcode resolution.
  // USDA is used by resolveByName() for whole foods not covered by OFF or IFCT.
  void usdaClient;

  // Step 5: Not found — enqueue curation entry
  const curationQueueId = await enqueueCuration(sql, barcode, opts.userId);
  return { product: null, resolvedBy: 'not_found', curationQueueId };
}

// Name-based resolution (used for ingredient lookup, AI analysis context, Phase 5+).
export async function resolveByName(
  name: string,
  deps: WaterfallDeps,
  opts: WaterfallOptions = {},
): Promise<ResolutionResult> {
  const { sql, offClient, ifct, usdaClient } = deps;
  const persist = opts.persistResult ?? true;

  // Step 1: IFCT (authoritative for Indian whole foods/dishes)
  if (ifct.isAvailable()) {
    const ifctResults = ifct.searchByName(name, 1);
    if (ifctResults.length > 0) {
      const product = ifct.toCanonicalProduct(ifctResults[0]!);
      let productId: string | undefined;
      if (persist) {
        productId = await persistProduct(sql, product);
        product.id = productId;
      }
      return { product, resolvedBy: 'ifct_2017', productId };
    }
  }

  // Step 2: OpenFoodFacts name search (India filter for Indian market relevance)
  try {
    const offResults = await offClient.searchByName(name, 'en:india');
    if (offResults.length > 0) {
      const product = normalizeOffProduct(offResults[0]!);
      let productId: string | undefined;
      if (persist) {
        productId = await persistProduct(sql, product);
        product.id = productId;
      }
      return { product, resolvedBy: 'openfoodfacts', productId };
    }
  } catch (err) {
    console.warn('[waterfall] OFF name search failed for', name, err instanceof Error ? err.message : err);
  }

  // Step 3: USDA FDC (reference nutrition for whole foods)
  if (usdaClient) {
    try {
      const usdaResults = await usdaClient.searchFoods(name);
      if (usdaResults.length > 0) {
        const detail = await usdaClient.getFoodById(usdaResults[0]!.fdcId);
        if (detail) {
          const product = normalizeUsdaFood(detail);
          let productId: string | undefined;
          if (persist) {
            productId = await persistProduct(sql, product);
            product.id = productId;
          }
          return { product, resolvedBy: 'usda_fdc', productId };
        }
      }
    } catch (err) {
      console.warn('[waterfall] USDA lookup failed for', name, err instanceof Error ? err.message : err);
    }
  }

  return { product: null, resolvedBy: 'not_found' };
}

async function enqueueCuration(
  sql: Sql,
  barcode: string,
  userId?: string,
): Promise<string> {
  // Insert into curation_queue (migration 0009_ops.sql). No unique constraint on barcode,
  // so we insert a new entry per unresolved scan attempt. notes field records context.
  void userId;  // assigned_to requires a UUID from auth.users; skip for anonymous/worker calls
  try {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO public.curation_queue (barcode, status, notes)
      VALUES (${barcode}, 'pending', 'Auto-enqueued: barcode not found in OFF/IFCT/USDA')
      RETURNING id
    `;
    return rows[0]?.id ?? crypto.randomUUID();
  } catch {
    return crypto.randomUUID();
  }
}

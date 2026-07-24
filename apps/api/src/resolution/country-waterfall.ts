// Country-aware food resolution waterfall — Phase 3 extension of waterfall.ts.
// When global.p3.unified_food_schema is OFF: delegates to existing waterfall unchanged.
// When ON: uses CountryProfile to route to the most relevant data source first.
//
// Source priority per country:
//   IN: edge cache → DB cache → OFF/India → IFCT → USDA → not_found   (existing, unchanged)
//   GB: edge cache → DB cache → CoFID 2021 → OFF/UK → USDA → not_found
//   US/CA: edge cache → DB cache → OFF/region → USDA → not_found
//   AE/GLOBAL: edge cache → DB cache → OFF/region → USDA → not_found
// Edge cache (Phase 7, `global.p7.edge_caching`) is the same optional `WaterfallDeps.edgeCache`
// in-process cache waterfall.ts uses — inherited via `CountryWaterfallDeps extends WaterfallDeps`.

import type { CountryProfile } from '../country/types.js';
import type { CofidLoader } from '../datasources/cofid/loader.js';
import {
  resolveBarcode as legacyResolveBarcode,
  resolveByName as legacyResolveByName,
  type WaterfallDeps,
  type WaterfallOptions,
  type ResolutionResult,
  type ResolutionSource,
} from './waterfall.js';
import { normalizeOffProduct } from '../datasources/openfoodfacts/normalize.js';
import { normalizeUsdaFood } from '../datasources/usda/normalize.js';
import { getProductFromCache, persistProduct } from '../datasources/openfoodfacts/cache.js';

// Extend source list with CoFID.
export type GlobalResolutionSource = ResolutionSource | 'cofid_2021';
export type GlobalResolutionResult = Omit<ResolutionResult, 'resolvedBy'> & {
  resolvedBy: GlobalResolutionSource;
};

export interface CountryWaterfallDeps extends WaterfallDeps {
  cofid: CofidLoader;
}

// Maps CountryProfile.isoCode to an OpenFoodFacts country-tag filter string.
// https://world.openfoodfacts.org/country
const OFF_COUNTRY_FILTER: Record<string, string> = {
  IN: 'en:india',
  GB: 'en:united-kingdom',
  US: 'en:united-states',
  CA: 'en:canada',
  AU: 'en:australia',
  DE: 'en:germany',
  FR: 'en:france',
  JP: 'en:japan',
  AE: 'en:united-arab-emirates',
  SG: 'en:singapore',
  BR: 'en:brazil',
  MX: 'en:mexico',
  ID: 'en:indonesia',
  KR: 'en:south-korea',
};

function offFilterFor(isoCode: string): string {
  return OFF_COUNTRY_FILTER[isoCode] ?? 'en:world';
}

export async function resolveBarcode(
  barcode: string,
  country: CountryProfile,
  deps: CountryWaterfallDeps,
  opts: WaterfallOptions & { engineEnabled: boolean },
): Promise<GlobalResolutionResult> {
  // Flag OFF: identical to existing barcode resolution (India-default)
  if (!opts.engineEnabled) {
    return legacyResolveBarcode(barcode, deps, opts) as Promise<GlobalResolutionResult>;
  }

  const { sql, offClient, ifct, usdaClient, cofid, edgeCache } = deps;
  const ttl = opts.ttlHours ?? 168;
  const persist = opts.persistResult ?? true;

  console.info(`[resolve:barcode] lookup requested barcode=${barcode} country=${country.isoCode}`);

  // Step 0: in-process edge cache (Phase 7, `global.p7.edge_caching`)
  const edgeHit = edgeCache?.get(barcode);
  if (edgeHit) {
    console.info(`[resolve:barcode] edge cache hit barcode=${barcode} productId=${edgeHit.id}`);
    return { product: edgeHit, resolvedBy: 'cache', productId: edgeHit.id };
  }

  // Step 1: DB cache (always first, regardless of country)
  console.info(`[resolve:barcode] supabase lookup barcode=${barcode}`);
  const cached = await getProductFromCache(sql, barcode, ttl);
  if (cached) {
    console.info(`[resolve:barcode] supabase lookup hit barcode=${barcode} productId=${cached.id}`);
    edgeCache?.set(barcode, cached);
    return { product: cached, resolvedBy: 'cache', productId: cached.id };
  }
  console.info(`[resolve:barcode] supabase lookup miss barcode=${barcode}`);

  // Step 2 (UK): CoFID — authoritative for UK food composition
  if (country.isoCode === 'GB' && cofid.isAvailable()) {
    // CoFID is a whole-foods composition database; no barcode mapping.
    // For UK-prefixed barcodes (500-509), we fall through to OFF/UK which does have barcodes.
    // CoFID is used primarily by resolveByName.
  }

  // Step 3: OpenFoodFacts with country-appropriate filter
  console.info(`[resolve:barcode] OFF fallback request barcode=${barcode} country=${country.isoCode}`);
  try {
    const offProduct = await offClient.getProduct(barcode);
    if (offProduct) {
      console.info(
        `[resolve:barcode] OFF fallback response: found barcode=${barcode} ` +
        `name=${offProduct.product_name ?? offProduct.product_name_en ?? 'unknown'}`,
      );
      const product = normalizeOffProduct(offProduct);
      product.countryCodes = [country.isoCode];
      product.sourceRegion = country.isoCode;
      let productId: string | undefined;
      if (persist) {
        productId = await persistProduct(sql, product);
        product.id = productId;
        console.info(`[resolve:barcode] cache insert barcode=${barcode} productId=${productId} source=openfoodfacts`);
      }
      edgeCache?.set(barcode, product);
      console.info(`[resolve:barcode] resolved barcode=${barcode} resolvedBy=openfoodfacts`);
      return { product, resolvedBy: 'openfoodfacts', productId };
    }
    console.info(`[resolve:barcode] OFF fallback response: not found barcode=${barcode}`);
  } catch (err) {
    console.warn('[country-waterfall] OFF lookup failed for', barcode, err instanceof Error ? err.message : err);
  }

  // Step 4 (India): IFCT for Indian whole-food packaged products
  if (country.isoCode === 'IN' && ifct.isAvailable() && barcode.startsWith('890')) {
    // Barcode prefix 890 = India; IFCT has whole-food equivalents by name only.
    // Fallthrough — no direct barcode↔IFCT mapping exists.
  }

  // Step 5: USDA FDC (no barcode in free tier — skip)
  void usdaClient;

  // Not found — enqueue curation with country context
  const { curationQueueId } = await legacyResolveBarcode(barcode, deps, { ...opts, persistResult: false });
  console.info(`[resolve:barcode] resolved barcode=${barcode} resolvedBy=not_found curationQueueId=${curationQueueId}`);
  return { product: null, resolvedBy: 'not_found', curationQueueId };
}

export async function resolveByName(
  name: string,
  country: CountryProfile,
  deps: CountryWaterfallDeps,
  opts: WaterfallOptions & { engineEnabled: boolean },
): Promise<GlobalResolutionResult> {
  // Flag OFF: identical to existing name resolution (India-default)
  if (!opts.engineEnabled) {
    return legacyResolveByName(name, deps, opts) as Promise<GlobalResolutionResult>;
  }

  const { sql, offClient, ifct, usdaClient, cofid } = deps;
  const persist = opts.persistResult ?? true;

  // UK path: CoFID first (authoritative UK food composition)
  if (country.isoCode === 'GB' && cofid.isAvailable()) {
    const cofidResults = cofid.searchByName(name, 1);
    if (cofidResults.length > 0) {
      const product = cofid.toCanonicalProduct(cofidResults[0]!);
      let productId: string | undefined;
      if (persist) { productId = await persistProduct(sql, product); product.id = productId; }
      return { product, resolvedBy: 'cofid_2021', productId };
    }
  }

  // India path: IFCT first (authoritative Indian food composition)
  if (country.isoCode === 'IN' && ifct.isAvailable()) {
    const ifctResults = ifct.searchByName(name, 1);
    if (ifctResults.length > 0) {
      const product = ifct.toCanonicalProduct(ifctResults[0]!);
      let productId: string | undefined;
      if (persist) { productId = await persistProduct(sql, product); product.id = productId; }
      return { product, resolvedBy: 'ifct_2017', productId };
    }
  }

  // All countries: OpenFoodFacts with country-appropriate filter
  const offFilter = offFilterFor(country.isoCode);
  try {
    const offResults = await offClient.searchByName(name, offFilter);
    if (offResults.length > 0) {
      const product = normalizeOffProduct(offResults[0]!);
      product.countryCodes = [country.isoCode];
      product.sourceRegion = country.isoCode;
      let productId: string | undefined;
      if (persist) { productId = await persistProduct(sql, product); product.id = productId; }
      return { product, resolvedBy: 'openfoodfacts', productId };
    }
  } catch (err) {
    console.warn('[country-waterfall] OFF name search failed for', name, err instanceof Error ? err.message : err);
  }

  // USDA FDC (all countries — reference nutrition database)
  if (usdaClient) {
    try {
      const usdaResults = await usdaClient.searchFoods(name);
      if (usdaResults.length > 0) {
        const detail = await usdaClient.getFoodById(usdaResults[0]!.fdcId);
        if (detail) {
          const product = normalizeUsdaFood(detail);
          product.countryCodes = [country.isoCode];
          let productId: string | undefined;
          if (persist) { productId = await persistProduct(sql, product); product.id = productId; }
          return { product, resolvedBy: 'usda_fdc', productId };
        }
      }
    } catch (err) {
      console.warn('[country-waterfall] USDA lookup failed for', name, err instanceof Error ? err.message : err);
    }
  }

  return { product: null, resolvedBy: 'not_found' };
}

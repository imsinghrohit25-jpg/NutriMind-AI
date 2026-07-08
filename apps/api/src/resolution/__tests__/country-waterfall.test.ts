// Country-aware food resolution waterfall — unit tests.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CountryProfile } from '../../country/types.js';
import type { CountryWaterfallDeps } from '../country-waterfall.js';
import type { WaterfallOptions } from '../waterfall.js';

// Mock the cache, normalizers, and legacy waterfall before importing the module under test.
vi.mock('../../datasources/openfoodfacts/cache.js', () => ({
  getProductFromCache: vi.fn().mockResolvedValue(null),
  persistProduct:     vi.fn().mockResolvedValue('mock-uuid'),
}));

vi.mock('../../datasources/openfoodfacts/normalize.js', () => ({
  normalizeOffProduct: vi.fn((p: any) => ({
    barcode: null, barcodeType: null, brand: null, category: null,
    subCategory: null, countryOfOrigin: null, servingSizeG: null, servingDescription: null,
    packageSizeG: null, fssaiVegMark: null, imageUrl: null, thumbnailUrl: null,
    nutrition: null, ingredientsRawText: null,
    sourceId: 'src', datasetVersion: 'live', retrievedAt: new Date(), licenseClass: 'odbl',
    countryCodes: [], sourceRegion: null,
    name: (p?.product_name ?? p?.name ?? 'OFF Product') as string,
    source: 'openfoodfacts' as const,
  })),
}));

vi.mock('../../datasources/usda/normalize.js', () => ({
  normalizeUsdaFood: vi.fn((p: any) => ({
    barcode: null, barcodeType: null, brand: null, category: null,
    subCategory: null, countryOfOrigin: null, servingSizeG: null, servingDescription: null,
    packageSizeG: null, fssaiVegMark: null, imageUrl: null, thumbnailUrl: null,
    nutrition: null, ingredientsRawText: null,
    sourceId: 'src', datasetVersion: 'live', retrievedAt: new Date(), licenseClass: 'odbl',
    countryCodes: [], sourceRegion: null,
    name: (p?.description ?? 'USDA Food') as string,
    source: 'usda_fdc' as const,
  })),
}));

// Mock the legacy waterfall so FLAG_OFF tests don't hit real DB.
vi.mock('../waterfall.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../waterfall.js')>();
  return {
    ...actual,
    resolveBarcode: vi.fn().mockResolvedValue({ product: null, resolvedBy: 'not_found' }),
    resolveByName:  vi.fn().mockResolvedValue({ product: null, resolvedBy: 'not_found' }),
  };
});

import { resolveBarcode, resolveByName } from '../country-waterfall.js';
import { getProductFromCache } from '../../datasources/openfoodfacts/cache.js';
import { resolveBarcode as legacyResolveBarcode, resolveByName as legacyResolveByName } from '../waterfall.js';

// ---------- helpers ----------

function baseProduct() {
  return {
    barcode: null, barcodeType: null, name: 'Product', brand: null, category: null,
    subCategory: null, countryOfOrigin: null, servingSizeG: null, servingDescription: null,
    packageSizeG: null, fssaiVegMark: null, imageUrl: null, thumbnailUrl: null,
    nutrition: null, ingredientsRawText: null,
    source: 'openfoodfacts', sourceId: 'src', datasetVersion: 'live',
    retrievedAt: new Date(), licenseClass: 'odbl',
  };
}

const makeProfile = (iso: string): CountryProfile => ({
  isoCode: iso, tier: 'tier1', displayName: iso, locale: 'en',
  currencyCode: 'USD', rtl: false, allergenRegime: 'WHO_GLOBAL',
  nutritionStandard: 'WHO', callingCode: '+1', mccList: [],
});

const INDIA  = makeProfile('IN');
const UK     = makeProfile('GB');
const GLOBAL = { ...makeProfile('GLOBAL'), tier: 'fallback' as const };

function makeDeps(overrides: Partial<CountryWaterfallDeps> = {}): CountryWaterfallDeps {
  return {
    sql: vi.fn() as any,   // not called — cache is mocked
    offClient: {
      getProduct:   vi.fn().mockResolvedValue(null),
      searchByName: vi.fn().mockResolvedValue([]),
    } as any,
    ifct: {
      isAvailable:       vi.fn().mockReturnValue(false),
      searchByName:      vi.fn().mockReturnValue([]),
      toCanonicalProduct: vi.fn(),
    } as any,
    usdaClient: null,
    cofid: {
      isAvailable:       vi.fn().mockReturnValue(false),
      searchByName:      vi.fn().mockReturnValue([]),
      toCanonicalProduct: vi.fn(),
    } as any,
    ...overrides,
  };
}

const FLAG_OFF: WaterfallOptions & { engineEnabled: boolean } = { engineEnabled: false, persistResult: false };
const FLAG_ON:  WaterfallOptions & { engineEnabled: boolean } = { engineEnabled: true,  persistResult: false };

beforeEach(() => {
  vi.mocked(getProductFromCache).mockResolvedValue(null);
});

// ---------- barcode ----------

describe('resolveBarcode', () => {
  it('flag OFF: delegates to legacy waterfall', async () => {
    const deps = makeDeps();
    await resolveBarcode('012345', INDIA, deps, FLAG_OFF);
    expect(legacyResolveBarcode).toHaveBeenCalled();
  });

  it('flag ON: returns not_found when all sources empty', async () => {
    const deps = makeDeps();
    const r = await resolveBarcode('012345', UK, deps, FLAG_ON);
    expect(r.product).toBeNull();
    expect(r.resolvedBy).toBe('not_found');
  });

  it('flag ON: resolves from cache when cache hit', async () => {
    const cachedProduct = { ...baseProduct(), id: 'cached-id', name: 'Cached' };
    vi.mocked(getProductFromCache).mockResolvedValueOnce(cachedProduct as any);
    const deps = makeDeps();
    const r = await resolveBarcode('012345', UK, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('cache');
    expect(r.product?.name).toBe('Cached');
  });

  it('flag ON: resolves from OpenFoodFacts when product found', async () => {
    const offProduct = { product_name: 'Test Product', nutriments: {} };
    const deps = makeDeps({
      offClient: {
        getProduct:   vi.fn().mockResolvedValue(offProduct),
        searchByName: vi.fn().mockResolvedValue([]),
      } as any,
    });
    const r = await resolveBarcode('012345', INDIA, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('openfoodfacts');
    expect(r.product).not.toBeNull();
  });

  it('flag ON: sets countryCode and sourceRegion on resolved product', async () => {
    const offProduct = { product_name: 'Test', nutriments: {} };
    const deps = makeDeps({
      offClient: {
        getProduct:   vi.fn().mockResolvedValue(offProduct),
        searchByName: vi.fn().mockResolvedValue([]),
      } as any,
    });
    const r = await resolveBarcode('012345', UK, deps, FLAG_ON);
    expect(r.product?.countryCodes).toContain('GB');
    expect(r.product?.sourceRegion).toBe('GB');
  });

  it('flag ON: handles OFF error, falls through to not_found', async () => {
    const deps = makeDeps({
      offClient: {
        getProduct:   vi.fn().mockRejectedValue(new Error('network')),
        searchByName: vi.fn().mockResolvedValue([]),
      } as any,
    });
    const r = await resolveBarcode('012345', UK, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('not_found');
    expect(r.product).toBeNull();
  });
});

// ---------- name resolution ----------

describe('resolveByName', () => {
  it('flag OFF: delegates to legacy waterfall', async () => {
    const deps = makeDeps();
    await resolveByName('dal', INDIA, deps, FLAG_OFF);
    expect(legacyResolveByName).toHaveBeenCalled();
  });

  it('flag ON India: resolves IFCT first', async () => {
    const ifctProduct = { ...baseProduct(), source: 'ifct_2017', name: 'Dal' };
    const deps = makeDeps({
      ifct: {
        isAvailable:       vi.fn().mockReturnValue(true),
        searchByName:      vi.fn().mockReturnValue([{ name: 'Dal', code: 'I001' }]),
        toCanonicalProduct: vi.fn().mockReturnValue(ifctProduct),
      } as any,
    });
    const r = await resolveByName('dal', INDIA, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('ifct_2017');
    expect(r.product).not.toBeNull();
  });

  it('flag ON UK: resolves CoFID first when available', async () => {
    const cofidProduct = { ...baseProduct(), source: 'cofid_2021', countryCodes: ['GB'], sourceRegion: 'GB', name: 'Cheddar' };
    const deps = makeDeps({
      cofid: {
        isAvailable:       vi.fn().mockReturnValue(true),
        searchByName:      vi.fn().mockReturnValue([{ food_code: 'UK001', food_name: 'Cheddar', food_group: 'dairy', energy_kcal: 403 }]),
        toCanonicalProduct: vi.fn().mockReturnValue(cofidProduct),
      } as any,
    });
    const r = await resolveByName('cheddar', UK, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('cofid_2021');
    expect(r.product?.sourceRegion).toBe('GB');
  });

  it('flag ON UK: falls through to OFF when CoFID unavailable', async () => {
    const offProduct = { product_name: 'Biscuits', nutriments: {} };
    const deps = makeDeps({
      cofid: {
        isAvailable: vi.fn().mockReturnValue(false),
        searchByName: vi.fn().mockReturnValue([]),
        toCanonicalProduct: vi.fn(),
      } as any,
      offClient: {
        searchByName: vi.fn().mockResolvedValue([offProduct]),
        getProduct:   vi.fn().mockResolvedValue(null),
      } as any,
    });
    const r = await resolveByName('biscuits', UK, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('openfoodfacts');
  });

  it('flag ON: uses country-specific OFF filter for Japan', async () => {
    const offClient = {
      searchByName: vi.fn().mockResolvedValue([]),
      getProduct:   vi.fn().mockResolvedValue(null),
    };
    const deps = makeDeps({ offClient: offClient as any });
    await resolveByName('noodles', makeProfile('JP'), deps, FLAG_ON);
    expect(offClient.searchByName).toHaveBeenCalledWith('noodles', 'en:japan');
  });

  it('flag ON IN: uses India OFF filter', async () => {
    const offClient = {
      searchByName: vi.fn().mockResolvedValue([]),
      getProduct:   vi.fn().mockResolvedValue(null),
    };
    const deps = makeDeps({ offClient: offClient as any });
    await resolveByName('roti', INDIA, deps, FLAG_ON);
    expect(offClient.searchByName).toHaveBeenCalledWith('roti', 'en:india');
  });

  it('flag ON GLOBAL: uses world OFF filter', async () => {
    const offClient = {
      searchByName: vi.fn().mockResolvedValue([]),
      getProduct:   vi.fn().mockResolvedValue(null),
    };
    const deps = makeDeps({ offClient: offClient as any });
    await resolveByName('rice', GLOBAL, deps, FLAG_ON);
    expect(offClient.searchByName).toHaveBeenCalledWith('rice', 'en:world');
  });

  it('flag ON: resolves USDA when all country sources fail', async () => {
    const usdaClient = {
      searchFoods: vi.fn().mockResolvedValue([{ fdcId: 123 }]),
      getFoodById: vi.fn().mockResolvedValue({ fdcId: 123, description: 'Rice' }),
    };
    const deps = makeDeps({ usdaClient: usdaClient as any });
    const r = await resolveByName('rice', UK, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('usda_fdc');
  });

  it('flag ON: returns not_found when all sources fail', async () => {
    const deps = makeDeps();
    const r = await resolveByName('unknown_food_xyz', UK, deps, FLAG_ON);
    expect(r.resolvedBy).toBe('not_found');
    expect(r.product).toBeNull();
  });
});

// ---------- OFF filter mapping ----------

describe('OFF country filter mapping', () => {
  it.each([
    ['IN', 'en:india'],
    ['GB', 'en:united-kingdom'],
    ['US', 'en:united-states'],
    ['JP', 'en:japan'],
    ['DE', 'en:germany'],
    ['AU', 'en:australia'],
    ['SG', 'en:singapore'],
    ['CA', 'en:canada'],
  ])('country %s uses OFF filter %s', async (iso, expectedFilter) => {
    const offClient = {
      searchByName: vi.fn().mockResolvedValue([]),
      getProduct:   vi.fn().mockResolvedValue(null),
    };
    const deps = makeDeps({ offClient: offClient as any });
    await resolveByName('test', makeProfile(iso), deps, FLAG_ON);
    expect(offClient.searchByName).toHaveBeenCalledWith('test', expectedFilter);
  });
});

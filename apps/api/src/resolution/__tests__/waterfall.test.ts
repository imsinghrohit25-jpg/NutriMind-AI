import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveBarcode, resolveByName, type WaterfallDeps } from '../waterfall.js';
import type { CanonicalProduct } from '../../nutrition/canonical-model.js';
import type { OFFProduct } from '../../datasources/openfoodfacts/client.js';

// Minimal canonical product for assertions
const MOCK_PRODUCT: CanonicalProduct = {
  source: 'openfoodfacts',
  sourceId: '8901234567890',
  datasetVersion: 'live',
  retrievedAt: new Date(),
  licenseClass: 'odbl',
  barcode: '8901234567890',
  barcodeType: 'ean13',
  name: 'Test Product',
  brand: 'Test Brand',
  category: 'snacks',
  subCategory: null,
  countryOfOrigin: 'india',
  servingSizeG: 30,
  servingDescription: '30g',
  packageSizeG: 150,
  fssaiVegMark: 'green',
  imageUrl: null,
  thumbnailUrl: null,
  nutrition: null,
  ingredientsRawText: null,
};

const MOCK_OFF_PRODUCT: OFFProduct = {
  _id: '8901234567890',
  product_name_en: 'Test Product',
  brands: 'Test Brand',
  countries_tags: ['en:india'],
  labels_tags: ['en:vegetarian'],
  nutriments: {
    'energy-kcal_100g': 350,
    proteins_100g: 5,
    fat_100g: 10,
    carbohydrates_100g: 55,
    sugars_100g: 5,
    sodium_100g: 0.001,
  },
};

function makeDeps(overrides: Partial<WaterfallDeps> = {}): WaterfallDeps {
  return {
    sql: {
      // Simulate "no cache hit" and "curation insert"
    } as unknown as WaterfallDeps['sql'],
    offClient: {
      getProduct: vi.fn().mockResolvedValue(null),
      searchByName: vi.fn().mockResolvedValue([]),
    } as unknown as WaterfallDeps['offClient'],
    ifct: {
      isAvailable: vi.fn().mockReturnValue(false),
      searchByName: vi.fn().mockReturnValue([]),
      toCanonicalProduct: vi.fn().mockReturnValue(MOCK_PRODUCT),
    } as unknown as WaterfallDeps['ifct'],
    usdaClient: null,
    ...overrides,
  };
}

// Shared SQL mock that simulates cache miss + curation insert
function makeSql(cacheResult: CanonicalProduct | null = null) {
  return vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    if (query.includes('retrieved_at >')) {
      // getProductFromCache — return empty (cache miss) or product
      return Promise.resolve(cacheResult ? [cacheResult] : []);
    }
    if (query.includes('product_nutrition')) {
      return Promise.resolve([]);
    }
    if (query.includes('product_ingredients')) {
      return Promise.resolve([]);
    }
    if (query.includes('INSERT INTO public.curation_queue')) {
      return Promise.resolve([{ id: 'curation-uuid-123' }]);
    }
    if (query.includes('INSERT INTO public.products')) {
      return Promise.resolve([{ id: 'product-uuid-456' }]);
    }
    if (query.includes('INSERT INTO public.product_nutrition')) {
      return Promise.resolve([]);
    }
    if (query.includes('INSERT INTO public.product_ingredients')) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }) as unknown as WaterfallDeps['sql'];
}

describe('resolveBarcode', () => {
  it('returns cached product when found in DB', async () => {
    const sql = makeSql(MOCK_PRODUCT);
    const deps = makeDeps({ sql });
    const result = await resolveBarcode('8901234567890', deps);
    expect(result.resolvedBy).toBe('cache');
    expect(result.product).toBeDefined();
    expect(result.product?.name).toBe('Test Product');
  });

  it('falls through to OFF when cache misses', async () => {
    const sql = makeSql(null);
    const offGetProduct = vi.fn().mockResolvedValue(MOCK_OFF_PRODUCT);
    const deps = makeDeps({
      sql,
      offClient: { getProduct: offGetProduct, searchByName: vi.fn() } as unknown as WaterfallDeps['offClient'],
    });
    const result = await resolveBarcode('8901234567890', deps);
    expect(result.resolvedBy).toBe('openfoodfacts');
    expect(offGetProduct).toHaveBeenCalledWith('8901234567890');
    expect(result.product?.name).toBe('Test Product');
  });

  it('enqueues curation when all sources fail', async () => {
    const sql = makeSql(null);
    const deps = makeDeps({ sql });
    const result = await resolveBarcode('9999999999999', deps, { persistResult: false });
    expect(result.resolvedBy).toBe('not_found');
    expect(result.product).toBeNull();
    expect(result.curationQueueId).toBeDefined();
  });

  it('handles OFF errors gracefully and falls through', async () => {
    const sql = makeSql(null);
    const offGetProduct = vi.fn().mockRejectedValue(new Error('network error'));
    const deps = makeDeps({
      sql,
      offClient: { getProduct: offGetProduct, searchByName: vi.fn() } as unknown as WaterfallDeps['offClient'],
    });
    const result = await resolveBarcode('1234567890123', deps, { persistResult: false });
    expect(result.resolvedBy).toBe('not_found');
  });

  it('does not re-hit OFF for cache hits', async () => {
    const sql = makeSql(MOCK_PRODUCT);
    const offGetProduct = vi.fn();
    const deps = makeDeps({
      sql,
      offClient: { getProduct: offGetProduct, searchByName: vi.fn() } as unknown as WaterfallDeps['offClient'],
    });
    await resolveBarcode('8901234567890', deps);
    expect(offGetProduct).not.toHaveBeenCalled();
  });
});

describe('resolveByName', () => {
  it('returns IFCT result when IFCT is available and matches', async () => {
    const sql = makeSql(null);
    const ifctEntry = {
      foodCode: 'A001', foodNameEn: 'Masoor Dal', foodNameHi: '', foodGroup: 'Pulses',
      moistureG: null, energyKcal: 343, proteinG: 25, fatTotalG: 0.5, carbohydratesG: 59,
      dietaryFiberG: 8, sugarsG: 2, ashG: null, calciumMg: 77, phosphorusMg: 320,
      ironMg: 7.5, sodiumMg: 30, potassiumMg: 644, zincMg: 3, vitaminCMg: 1.5,
      betaCaroteneMcg: 270, thiamineMg: 0.4, riboflavinMg: 0.2, niacinMg: 7, folateMcg: 520,
      vitaminB12Mcg: 0, cholesterolMg: 0,
    };
    const mockIfct = {
      isAvailable: vi.fn().mockReturnValue(true),
      searchByName: vi.fn().mockReturnValue([ifctEntry]),
      toCanonicalProduct: vi.fn().mockReturnValue({ ...MOCK_PRODUCT, name: 'Masoor Dal', source: 'ifct_2017' }),
    };
    const deps = makeDeps({ sql, ifct: mockIfct as unknown as WaterfallDeps['ifct'] });
    const result = await resolveByName('masoor dal', deps, { persistResult: false });
    expect(result.resolvedBy).toBe('ifct_2017');
    expect(result.product?.name).toBe('Masoor Dal');
  });

  it('falls through to OFF when IFCT unavailable', async () => {
    const sql = makeSql(null);
    const offSearchByName = vi.fn().mockResolvedValue([MOCK_OFF_PRODUCT]);
    const deps = makeDeps({
      sql,
      offClient: { getProduct: vi.fn(), searchByName: offSearchByName } as unknown as WaterfallDeps['offClient'],
    });
    const result = await resolveByName('test product', deps, { persistResult: false });
    expect(offSearchByName).toHaveBeenCalled();
    expect(result.resolvedBy).toBe('openfoodfacts');
  });

  it('returns not_found when all sources exhausted', async () => {
    const sql = makeSql(null);
    const deps = makeDeps({ sql });
    const result = await resolveByName('xyzzy nonexistent food', deps, { persistResult: false });
    expect(result.resolvedBy).toBe('not_found');
    expect(result.product).toBeNull();
  });
});

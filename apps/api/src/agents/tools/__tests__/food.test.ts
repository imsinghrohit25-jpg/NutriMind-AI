import { describe, it, expect, vi, beforeEach } from 'vitest';
import { foodSearchTool, _resetFoodToolFlagCache } from '../food.js';
import type { ToolContext } from '../../types.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';

function makeProduct(source: string, name: string): CanonicalProduct {
  return {
    source, sourceId: 'x', datasetVersion: 'v', retrievedAt: new Date(), licenseClass: 'public_domain',
    barcode: null, barcodeType: null, name, brand: null, category: null, subCategory: null,
    countryOfOrigin: null, servingSizeG: null, servingDescription: null, packageSizeG: null,
    fssaiVegMark: null, imageUrl: null, thumbnailUrl: null, nutrition: null, ingredientsRawText: null,
  };
}

const COFID_PRODUCT = makeProduct('cofid_2021', 'Cheddar Cheese');
const IFCT_PRODUCT = makeProduct('ifct_2017', 'Masoor Dal');
const OFF_PRODUCT = makeProduct('openfoodfacts', 'Some Snack');

function makeSql() {
  return vi.fn().mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO public.products')) return Promise.resolve([{ id: 'product-uuid' }]);
    return Promise.resolve([]);
  });
}

function makeSupabase(flagEnabled: boolean) {
  return {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: flagEnabled }, error: null }) }) }) }),
    })),
  };
}

function makeCtx(opts: { flagEnabled: boolean; countryCode: string; cofidAvailable?: boolean; ifctAvailable?: boolean }): ToolContext {
  return {
    supabase: makeSupabase(opts.flagEnabled) as never,
    sql: makeSql() as never,
    gateway: null,
    offClient: {
      getProduct: vi.fn().mockResolvedValue(null),
      searchByName: vi.fn().mockResolvedValue([OFF_PRODUCT]),
    } as never,
    usdaClient: null,
    ifct: {
      isAvailable: () => opts.ifctAvailable ?? false,
      searchByName: () => ((opts.ifctAvailable ?? false) ? [{}] : []),
      toCanonicalProduct: () => IFCT_PRODUCT,
    } as never,
    cofid: {
      isAvailable: () => opts.cofidAvailable ?? false,
      searchByName: () => ((opts.cofidAvailable ?? false) ? [{}] : []),
      toCanonicalProduct: () => COFID_PRODUCT,
    } as never,
    userId: 'test-user',
    countryCode: opts.countryCode,
  };
}

describe('foodSearchTool — country-aware wiring (global.p3.unified_food_schema)', () => {
  beforeEach(() => {
    _resetFoodToolFlagCache();
  });

  it('flag OFF: resolves via OpenFoodFacts exactly as before, even for a GB user with CoFID available', async () => {
    const result = await foodSearchTool.execute({ name: 'cheese' }, makeCtx({ flagEnabled: false, countryCode: 'GB', cofidAvailable: true }));
    expect(result.resolvedBy).toBe('openfoodfacts');
  });

  it('flag ON, GB user: resolves via CoFID first when available', async () => {
    const result = await foodSearchTool.execute({ name: 'cheese' }, makeCtx({ flagEnabled: true, countryCode: 'GB', cofidAvailable: true }));
    expect(result.resolvedBy).toBe('cofid_2021');
    expect(result.product?.name).toBe('Cheddar Cheese');
  });

  it('flag ON, IN user: resolves via IFCT first when available', async () => {
    const result = await foodSearchTool.execute({ name: 'dal' }, makeCtx({ flagEnabled: true, countryCode: 'IN', ifctAvailable: true }));
    expect(result.resolvedBy).toBe('ifct_2017');
  });

  it('flag ON, GB user, CoFID unavailable: falls through to OpenFoodFacts', async () => {
    const result = await foodSearchTool.execute({ name: 'cheese' }, makeCtx({ flagEnabled: true, countryCode: 'GB', cofidAvailable: false }));
    expect(result.resolvedBy).toBe('openfoodfacts');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { foodSearchTool, _resetFoodToolFlagCache } from '../food.js';
import type { ToolContext } from '../../types.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';

function makeProduct(source: string, name: string, datasetVersion = 'v'): CanonicalProduct {
  return {
    source, sourceId: 'x', datasetVersion, retrievedAt: new Date(), licenseClass: 'public_domain',
    barcode: null, barcodeType: null, name, brand: null, category: null, subCategory: null,
    countryOfOrigin: null, servingSizeG: null, servingDescription: null, packageSizeG: null,
    fssaiVegMark: null, imageUrl: null, thumbnailUrl: null,
    nutrition: {
      source, sourceId: 'x', datasetVersion, retrievedAt: new Date(), licenseClass: 'public_domain',
      energyKcal: 400, energyKj: null, proteinG: 25, fatTotalG: 33, fatSaturatedG: null, fatTransG: null,
      fatPolyunsaturatedG: null, fatMonounsaturatedG: null, carbohydratesG: 0.1, sugarsG: 0.1,
      sugarsAddedG: null, sugarsAddedEstimated: false, dietaryFiberG: null, sodiumMg: 700,
      cholesterolMg: null, calciumMg: null, ironMg: null, potassiumMg: null, zincMg: null,
      vitaminCMg: null, vitaminAIu: null, vitaminDIu: 12, vitaminB12Mcg: null, folateMcg: null,
      novaGroup: null, confidence: 0.95, notes: null, ashG: null, moistureG: null,
      nutrientValueState: { vitaminDIu: 'estimated' },
    },
    ingredientsRawText: null,
  };
}

const COFID_PRODUCT = makeProduct('cofid_2021', 'Cheddar Cheese', '2021');
const IFCT_PRODUCT = makeProduct('ifct_2017', 'Masoor Dal');
const OFF_PRODUCT = makeProduct('openfoodfacts', 'Some Snack');

function makeSql() {
  const fn = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO public.products')) return Promise.resolve([{ id: 'product-uuid' }]);
    if (query.includes('FROM public.data_sources')) {
      return Promise.resolve([{
        display_name: 'UK Composition of Foods Integrated Dataset (CoFID)',
        license_class: 'public_domain',
        attribution_text: 'Contains public sector information licensed under the Open Government Licence v3.0.',
        terms_url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      }]);
    }
    if (query.includes('FROM public.import_batches')) {
      return Promise.resolve([{ id: 'batch-uuid-123' }]);
    }
    return Promise.resolve([]);
  });
  // postgres.js's real Sql tag function carries a `.json()` helper used by persistProduct to wrap
  // JSONB columns — a plain vi.fn() mock doesn't have one, so attach a passthrough identity here.
  (fn as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
  return fn;
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

  it('attaches a real citation (source display, licence, batch id, data quality grade, estimated-value note) — never a placeholder', async () => {
    const result = await foodSearchTool.execute({ name: 'cheese' }, makeCtx({ flagEnabled: true, countryCode: 'GB', cofidAvailable: true }));
    expect(result.citation).toEqual({
      source: 'cofid_2021',
      sourceDisplay: 'UK Composition of Foods Integrated Dataset (CoFID)',
      licenseClass: 'public_domain',
      attributionText: 'Contains public sector information licensed under the Open Government Licence v3.0.',
      termsUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      datasetVersion: '2021',
      importBatchId: 'batch-uuid-123',
      sourceFoodId: 'x',
      dataQualityGrade: 'A',
      valueStateNotes: ['vitaminDIu is an estimated value (flagged by the source)'],
    });
  });

  it('citation is null when nothing resolves', async () => {
    const result = await foodSearchTool.execute(
      { name: 'nonexistent' },
      { ...makeCtx({ flagEnabled: true, countryCode: 'GB' }), offClient: { getProduct: vi.fn(), searchByName: vi.fn().mockResolvedValue([]) } as never },
    );
    expect(result.resolvedBy).toBe('not_found');
    expect(result.citation).toBeNull();
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

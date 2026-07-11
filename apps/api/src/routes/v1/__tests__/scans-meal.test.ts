import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { lookupCountryOrGlobal } from '../../../country/registry.js';
import { INDIA_PROFILE } from '../../../country/types.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';

// Module-mock the vision pipeline so this test isolates the country-aware resolution wiring
// (ADR-0033 §11 follow-up) added to scans.ts's /scans/meal handler, without needing to replicate
// the real gateway.complete() JSON-parsing contract analyseMealPhoto depends on.
vi.mock('../../../scan/meal-photo/vision.js', () => ({
  analyseMealPhoto: vi.fn().mockResolvedValue({
    isFood: true,
    isIndianFood: false,
    sceneDescription: 'a plate of cheese',
    candidates: [{
      name: 'Cheddar Cheese', nameLocalised: null, confidence: 0.9, cuisine: null,
      portionSizeHint: null, searchQuery: 'cheddar cheese',
    }],
    notes: null,
  }),
}));

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
      vitaminCMg: null, vitaminAIu: null, vitaminDIu: null, vitaminB12Mcg: null, folateMcg: null,
      novaGroup: null, confidence: 0.95, notes: null, ashG: null, moistureG: null,
    },
    ingredientsRawText: null,
  };
}

const COFID_PRODUCT = makeProduct('cofid_2021', 'Cheddar Cheese', '2021');
const OFF_PRODUCT = makeProduct('openfoodfacts', 'Some Snack');

function makeSupabase(flagEnabled: boolean) {
  return {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: flagEnabled }, error: null }) }) }) }),
    })),
  };
}

async function buildApp(opts: { flagEnabled: boolean; cofidAvailable: boolean; offAvailable?: boolean }): Promise<FastifyInstance> {
  const { default: scanRoutes, _resetScansUnifiedFoodSchemaFlagCache } = await import('../scans.js');
  _resetScansUnifiedFoodSchemaFlagCache();

  const app = Fastify({ logger: false });
  app.decorate('supabase', makeSupabase(opts.flagEnabled) as never);
  const sqlFn = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
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
    if (query.includes('FROM public.import_batches')) return Promise.resolve([{ id: 'batch-uuid-123' }]);
    return Promise.resolve([]);
  });
  (sqlFn as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
  app.decorate('sql', sqlFn as never);
  app.decorate('gateway', { complete: vi.fn() } as never);
  const offAvailable = opts.offAvailable ?? true;
  app.decorate('offClient', {
    getProduct: vi.fn().mockResolvedValue(null),
    searchByName: vi.fn().mockResolvedValue(offAvailable ? [OFF_PRODUCT] : []),
  } as never);
  app.decorate('usdaClient', null as never);
  app.decorate('ifct', { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
  app.decorate('cofid', {
    isAvailable: () => opts.cofidAvailable,
    searchByName: () => (opts.cofidAvailable ? [{}] : []),
    toCanonicalProduct: () => COFID_PRODUCT,
  } as never);
  app.decorateRequest('country', null as never);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.country = opts.cofidAvailable ? lookupCountryOrGlobal('GB') : INDIA_PROFILE;
  });
  await app.register(scanRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

describe('POST /v1/scans/meal — country-aware nutrition resolution (ADR-0033 §11 follow-up)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flag OFF: resolves top-dish nutrition via OpenFoodFacts exactly as before', async () => {
    const app = await buildApp({ flagEnabled: false, cofidAvailable: true });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/meal',
      payload: { imageBase64: 'x'.repeat(200) },
    });
    const body = JSON.parse(resp.body);
    expect(body.data.topCandidateResolvedBy).toBe('openfoodfacts');
    await app.close();
  });

  it('flag ON, GB request: resolves top-dish nutrition via CoFID first', async () => {
    const app = await buildApp({ flagEnabled: true, cofidAvailable: true });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/meal',
      payload: { imageBase64: 'x'.repeat(200) },
    });
    const body = JSON.parse(resp.body);
    expect(body.data.topCandidateResolvedBy).toBe('cofid_2021');
    await app.close();
  });

  it('attaches a real topCandidateCitation (source display, licence, batch id) when nutrition resolves — never a placeholder', async () => {
    const app = await buildApp({ flagEnabled: true, cofidAvailable: true });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/meal',
      payload: { imageBase64: 'x'.repeat(200) },
    });
    const body = JSON.parse(resp.body);
    expect(body.data.topCandidateCitation).toMatchObject({
      source: 'cofid_2021',
      sourceDisplay: 'UK Composition of Foods Integrated Dataset (CoFID)',
      datasetVersion: '2021',
      importBatchId: 'batch-uuid-123',
      dataQualityGrade: 'A',
    });
    await app.close();
  });

  it('topCandidateCitation is null when no dish resolves', async () => {
    const app = await buildApp({ flagEnabled: true, cofidAvailable: false, offAvailable: false });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/meal',
      payload: { imageBase64: 'x'.repeat(200) },
    });
    const body = JSON.parse(resp.body);
    expect(body.data.topCandidateCitation).toBeNull();
    await app.close();
  });
});

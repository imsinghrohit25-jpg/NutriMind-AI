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

function makeProduct(source: string, name: string): CanonicalProduct {
  return {
    source, sourceId: 'x', datasetVersion: 'v', retrievedAt: new Date(), licenseClass: 'public_domain',
    barcode: null, barcodeType: null, name, brand: null, category: null, subCategory: null,
    countryOfOrigin: null, servingSizeG: null, servingDescription: null, packageSizeG: null,
    fssaiVegMark: null, imageUrl: null, thumbnailUrl: null,
    nutrition: { energyKcal: 400 } as CanonicalProduct['nutrition'], ingredientsRawText: null,
  };
}

const COFID_PRODUCT = makeProduct('cofid_2021', 'Cheddar Cheese');
const OFF_PRODUCT = makeProduct('openfoodfacts', 'Some Snack');

function makeSupabase(flagEnabled: boolean) {
  return {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: flagEnabled }, error: null }) }) }) }),
    })),
  };
}

async function buildApp(opts: { flagEnabled: boolean; cofidAvailable: boolean }): Promise<FastifyInstance> {
  const { default: scanRoutes, _resetScansUnifiedFoodSchemaFlagCache } = await import('../scans.js');
  _resetScansUnifiedFoodSchemaFlagCache();

  const app = Fastify({ logger: false });
  app.decorate('supabase', makeSupabase(opts.flagEnabled) as never);
  app.decorate('sql', vi.fn().mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO public.products')) return Promise.resolve([{ id: 'product-uuid' }]);
    return Promise.resolve([]);
  }) as never);
  app.decorate('gateway', { complete: vi.fn() } as never);
  app.decorate('offClient', {
    getProduct: vi.fn().mockResolvedValue(null),
    searchByName: vi.fn().mockResolvedValue([OFF_PRODUCT]),
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
});

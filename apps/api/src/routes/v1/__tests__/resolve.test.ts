import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { vi } from 'vitest';
import resolveRoutes, { _resetUnifiedFoodSchemaFlagCache } from '../resolve.js';
import { lookupCountryOrGlobal } from '../../../country/registry.js';
import { INDIA_PROFILE } from '../../../country/types.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';
import type { WaterfallDeps } from '../../../resolution/waterfall.js';

// Real book-derived-style fixtures — each source's own product, distinguishable by `source`.
function makeProduct(source: string, name: string): CanonicalProduct {
  return {
    source,
    sourceId: 'x',
    datasetVersion: 'v',
    retrievedAt: new Date(),
    licenseClass: 'public_domain',
    barcode: null,
    barcodeType: null,
    name,
    brand: null,
    category: null,
    subCategory: null,
    countryOfOrigin: null,
    servingSizeG: null,
    servingDescription: null,
    packageSizeG: null,
    fssaiVegMark: null,
    imageUrl: null,
    thumbnailUrl: null,
    nutrition: null,
    ingredientsRawText: null,
  };
}

const COFID_PRODUCT = makeProduct('cofid_2021', 'Cheddar Cheese');
const IFCT_PRODUCT = makeProduct('ifct_2017', 'Masoor Dal');
const OFF_PRODUCT = makeProduct('openfoodfacts', 'Some Snack');

function makeSql() {
  // Always a cache miss; INSERT ... RETURNING id returns a fake id — mirrors
  // resolution/__tests__/waterfall.test.ts's own makeSql helper.
  return vi.fn().mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO public.products')) return Promise.resolve([{ id: 'product-uuid' }]);
    return Promise.resolve([]);
  }) as unknown as WaterfallDeps['sql'];
}

function makeSupabase(flagEnabled: boolean) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: () => Promise.resolve({ data: { enabled: flagEnabled }, error: null }),
          }),
        }),
      }),
    })),
  };
}

function buildApp(opts: {
  flagEnabled: boolean;
  country: string;
  cofidAvailable?: boolean;
  ifctAvailable?: boolean;
}): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate('supabase', makeSupabase(opts.flagEnabled) as never);
  app.decorate('sql', makeSql());
  app.decorate('offClient', {
    getProduct: vi.fn().mockResolvedValue(null),
    searchByName: vi.fn().mockResolvedValue([OFF_PRODUCT]),
  } as never);
  app.decorate('usdaClient', null as never);
  app.decorate('ifct', {
    isAvailable: () => opts.ifctAvailable ?? false,
    searchByName: () => ((opts.ifctAvailable ?? false) ? [{}] : []),
    toCanonicalProduct: () => IFCT_PRODUCT,
  } as never);
  app.decorate('cofid', {
    isAvailable: () => opts.cofidAvailable ?? false,
    searchByName: () => ((opts.cofidAvailable ?? false) ? [{}] : []),
    toCanonicalProduct: () => COFID_PRODUCT,
  } as never);
  app.decorate('productCache', undefined as never);
  app.decorateRequest('country', null as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.country = opts.country === 'IN' ? INDIA_PROFILE : lookupCountryOrGlobal(opts.country);
  });
  return app;
}

describe('POST /v1/resolve/name — country-aware wiring (global.p3.unified_food_schema)', () => {
  beforeEach(() => {
    _resetUnifiedFoodSchemaFlagCache();
  });

  it('flag OFF: resolves via OpenFoodFacts exactly as before, even for a GB request with CoFID available', async () => {
    const app = buildApp({ flagEnabled: false, country: 'GB', cofidAvailable: true });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/name', payload: { name: 'cheese' } });
    const body = JSON.parse(resp.body);
    expect(body.data.resolvedBy).toBe('openfoodfacts');
    await app.close();
  });

  it('flag ON, GB request: resolves via CoFID first when available', async () => {
    const app = buildApp({ flagEnabled: true, country: 'GB', cofidAvailable: true });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/name', payload: { name: 'cheese' } });
    const body = JSON.parse(resp.body);
    expect(body.data.resolvedBy).toBe('cofid_2021');
    expect(body.data.product.name).toBe('Cheddar Cheese');
    await app.close();
  });

  it('flag ON, GB request, CoFID unavailable: falls through to OpenFoodFacts', async () => {
    const app = buildApp({ flagEnabled: true, country: 'GB', cofidAvailable: false });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/name', payload: { name: 'cheese' } });
    const body = JSON.parse(resp.body);
    expect(body.data.resolvedBy).toBe('openfoodfacts');
    await app.close();
  });

  it('flag ON, IN request: resolves via IFCT first when available', async () => {
    const app = buildApp({ flagEnabled: true, country: 'IN', ifctAvailable: true });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/name', payload: { name: 'dal' } });
    const body = JSON.parse(resp.body);
    expect(body.data.resolvedBy).toBe('ifct_2017');
    expect(body.data.product.name).toBe('Masoor Dal');
    await app.close();
  });

  it('flag ON, GB request: never returns IFCT data for a UK request even if the IFCT loader happens to be available', async () => {
    const app = buildApp({ flagEnabled: true, country: 'GB', cofidAvailable: true, ifctAvailable: true });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/name', payload: { name: 'cheese' } });
    const body = JSON.parse(resp.body);
    expect(body.data.resolvedBy).toBe('cofid_2021');
    await app.close();
  });
});

describe('POST /v1/resolve/barcode — country threaded through without breaking the existing contract', () => {
  beforeEach(() => {
    _resetUnifiedFoodSchemaFlagCache();
  });

  it('flag ON, GB request, no match anywhere: still returns the existing 404 not-found contract', async () => {
    const app = buildApp({ flagEnabled: true, country: 'GB' });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/barcode', payload: { barcode: '5000000000000' } });
    expect(resp.statusCode).toBe(404);
    const body = JSON.parse(resp.body);
    expect(body.data.found).toBe(false);
    await app.close();
  });
});

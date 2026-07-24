import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { vi } from 'vitest';
import resolveRoutes, { _resetUnifiedFoodSchemaFlagCache } from '../resolve.js';
import { lookupCountryOrGlobal } from '../../../country/registry.js';
import { INDIA_PROFILE } from '../../../country/types.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';
import type { WaterfallDeps } from '../../../resolution/waterfall.js';

// Real book-derived-style fixtures — each source's own product, distinguishable by `source`.
function makeProduct(source: string, name: string, datasetVersion = 'v'): CanonicalProduct {
  return {
    source,
    sourceId: 'x',
    datasetVersion,
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
const IFCT_PRODUCT = makeProduct('ifct_2017', 'Masoor Dal');
const OFF_PRODUCT = makeProduct('openfoodfacts', 'Some Snack');

function makeSql() {
  // Always a cache miss; INSERT ... RETURNING id returns a fake id — mirrors
  // resolution/__tests__/waterfall.test.ts's own makeSql helper.
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
    if (query.includes('FROM public.import_batches')) return Promise.resolve([{ id: 'batch-uuid-123' }]);
    return Promise.resolve([]);
  });
  // postgres.js's real Sql tag function carries a `.json()` helper used by persistProduct to wrap
  // JSONB columns — a plain vi.fn() mock doesn't have one, so attach a passthrough identity here.
  (fn as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
  return fn as unknown as WaterfallDeps['sql'];
}

function makeSupabase(flagEnabled: boolean, profile?: { conditions?: string[]; allergens?: string[] }) {
  return {
    // Two distinct chain shapes hit this mock: the feature-flag lookup
    // (select().eq().is().maybeSingle()) and fetchProfileSlice's users_profiles lookup
    // (select().eq().maybeSingle(), no `.is()`) — both terminate in `.maybeSingle()`, so a single
    // chainable that supports either call order (and answers with whichever payload the caller
    // actually wants) covers both without needing to know which query is running.
    from: vi.fn((table: string) => {
      if (table === 'users_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: profile
                  ? { conditions: profile.conditions ?? [], medications: [], reproductive_status: null, allergens: profile.allergens ?? [] }
                  : null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () => Promise.resolve({ data: { enabled: flagEnabled }, error: null }),
            }),
          }),
        }),
      };
    }),
  };
}

function buildApp(opts: {
  flagEnabled: boolean;
  country: string;
  cofidAvailable?: boolean;
  ifctAvailable?: boolean;
  offBarcodeMatch?: boolean;
  profile?: { conditions?: string[]; allergens?: string[] };
  userId?: string;
}): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate('supabase', makeSupabase(opts.flagEnabled, opts.profile) as never);
  app.decorate('sql', makeSql());
  app.decorate('offClient', {
    getProduct: vi.fn().mockResolvedValue(opts.offBarcodeMatch ? OFF_PRODUCT : null),
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
    if (opts.userId) request.user = { id: opts.userId, role: 'authenticated' };
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

  it('attaches a real citation (source display, licence, batch id, data quality grade) — never a placeholder', async () => {
    const app = buildApp({ flagEnabled: true, country: 'GB', cofidAvailable: true });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/name', payload: { name: 'cheese' } });
    const body = JSON.parse(resp.body);
    expect(body.data.citation).toMatchObject({
      source: 'cofid_2021',
      sourceDisplay: 'UK Composition of Foods Integrated Dataset (CoFID)',
      datasetVersion: '2021',
      importBatchId: 'batch-uuid-123',
      dataQualityGrade: 'A',
    });
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

  it('flag ON, GB request, OFF match found: attaches a real citation alongside the resolved product', async () => {
    const app = buildApp({ flagEnabled: true, country: 'GB', offBarcodeMatch: true });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/barcode', payload: { barcode: '5000000000000' } });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.resolvedBy).toBe('openfoodfacts');
    expect(body.data.citation).toMatchObject({ source: 'openfoodfacts' });
    await app.close();
  });

  // Premium redesign Phase 3 — before this, a resolved product never carried a Health Score or
  // allergen safety data at all, even though engines/score/engine.ts and engines/allergen/
  // detector.ts were fully built and tested. These pin the new fields onto the real response.
  it('attaches a real computed Health Score alongside the resolved product (anonymous caller)', async () => {
    const app = buildApp({ flagEnabled: true, country: 'GB', offBarcodeMatch: true });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({ method: 'POST', url: '/v1/resolve/barcode', payload: { barcode: '5000000000000' } });
    const body = JSON.parse(resp.body);
    expect(body.data.healthScore).toBeTruthy();
    expect(typeof body.data.healthScore.score).toBe('number');
    expect(body.data.healthScore.subscores.sodium).toBeTruthy();
    // Anonymous caller — no profile, so every taxonomy allergen is checked (the engine's own
    // safer default), and disease guidance is null (no conditions to evaluate against).
    expect(body.data.safety).toBeTruthy();
    expect(Array.isArray(body.data.safety.allergenMatches)).toBe(true);
    expect(body.data.diseaseGuidance).toBeNull();
    await app.close();
  });

  it('fetches the signed-in user\'s profile (conditions + allergens) via users_profiles, not a mock persona', async () => {
    const app = buildApp({
      flagEnabled: true,
      country: 'GB',
      offBarcodeMatch: true,
      userId: 'user-1',
      profile: { conditions: ['diabetes_type2'], allergens: ['milk'] },
    });
    await app.register(resolveRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST',
      url: '/v1/resolve/barcode',
      payload: { barcode: '5000000000000' },
    });
    const body = JSON.parse(resp.body);
    // The fixture product (OFF_PRODUCT) has ingredientsRawText: null — no allergen keywords to
    // match — so the correct result is an empty (not null/undefined) allergenMatches array, which
    // only happens if the profile fetch + detector call actually ran end-to-end without throwing.
    expect(body.data.safety.allergenMatches).toEqual([]);
    expect(body.data.safety.hasFailSafe).toBe(false);
    // Real nutrition + a declared condition → diseaseGuidance must be a real evaluation, not null.
    expect(Array.isArray(body.data.diseaseGuidance)).toBe(true);
    const supabase = (app as unknown as { supabase: { from: ReturnType<typeof vi.fn> } }).supabase;
    expect(supabase.from).toHaveBeenCalledWith('users_profiles');
    await app.close();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { INDIA_PROFILE } from '../../../country/types.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';

function makeProduct(name: string): CanonicalProduct {
  return {
    source: 'ifct_2017', sourceId: 'x', datasetVersion: '2017', retrievedAt: new Date(),
    licenseClass: 'public_domain', barcode: null, barcodeType: null, name, brand: null,
    category: null, subCategory: null, countryOfOrigin: null, servingSizeG: null,
    servingDescription: null, packageSizeG: null, fssaiVegMark: null, imageUrl: null,
    thumbnailUrl: null,
    nutrition: {
      source: 'ifct_2017', sourceId: 'x', datasetVersion: '2017', retrievedAt: new Date(),
      licenseClass: 'public_domain', energyKcal: 250, energyKj: null, proteinG: 5, fatTotalG: 2,
      fatSaturatedG: null, fatTransG: null, fatPolyunsaturatedG: null, fatMonounsaturatedG: null,
      carbohydratesG: 40, sugarsG: 1, sugarsAddedG: null, sugarsAddedEstimated: false,
      dietaryFiberG: null, sodiumMg: 400, cholesterolMg: null, calciumMg: null, ironMg: null,
      potassiumMg: null, zincMg: null, vitaminCMg: null, vitaminAIu: null, vitaminDIu: null,
      vitaminB12Mcg: null, folateMcg: null, novaGroup: null, confidence: 0.9, notes: null,
      ashG: null, moistureG: null,
    },
    ingredientsRawText: null,
  };
}

const MATCHED_PRODUCT = makeProduct('Poha');

/** Supabase mock that resolves feature_flags by the actual `key` queried, so the enrichment flag
 *  and the unified-food-schema flag can be toggled independently — unlike scans-meal.test.ts's
 *  single-flag mock, this route can consult two different flags in the same request. */
function makeSupabase(flags: Record<string, boolean>) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          is: () => ({
            maybeSingle: () => Promise.resolve({ data: { enabled: flags[key] ?? false }, error: null }),
          }),
        }),
      }),
    })),
  };
}

async function buildApp(opts: {
  enrichmentFlagEnabled: boolean;
  unifiedSchemaFlagEnabled?: boolean;
  gatewayComplete?: (...args: unknown[]) => Promise<unknown>;
  noGateway?: boolean;
}): Promise<FastifyInstance> {
  const {
    default: scanRoutes,
    _resetScansUnifiedFoodSchemaFlagCache,
    _resetGeminiLabelEnrichmentFlagCache,
  } = await import('../scans.js');
  _resetScansUnifiedFoodSchemaFlagCache();
  _resetGeminiLabelEnrichmentFlagCache();

  const app = Fastify({ logger: false });
  app.decorate(
    'supabase',
    makeSupabase({
      'global.p14.gemini_label_enrichment': opts.enrichmentFlagEnabled,
      'global.p3.unified_food_schema': opts.unifiedSchemaFlagEnabled ?? true,
    }) as never,
  );
  const sqlFn = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO public.products')) return Promise.resolve([{ id: 'product-uuid' }]);
    if (query.includes('FROM public.data_sources')) {
      return Promise.resolve([{
        display_name: 'Indian Food Composition Tables 2017',
        license_class: 'public_domain',
        attribution_text: 'ICMR-NIN',
        terms_url: null,
      }]);
    }
    if (query.includes('FROM public.import_batches')) return Promise.resolve([{ id: 'batch-1' }]);
    return Promise.resolve([]);
  });
  (sqlFn as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
  app.decorate('sql', sqlFn as never);

  if (!opts.noGateway) {
    app.decorate('gateway', { complete: vi.fn(opts.gatewayComplete ?? (async () => ({ content: '{}' }))) } as never);
  } else {
    app.decorate('gateway', null as never);
  }

  app.decorate('offClient', { getProduct: vi.fn(), searchByName: vi.fn().mockResolvedValue([]) } as never);
  app.decorate('usdaClient', null as never);
  app.decorate('ifct', {
    isAvailable: () => true,
    searchByName: (q: string) => (q === 'Poha' ? [{}] : []),
    toCanonicalProduct: () => MATCHED_PRODUCT,
  } as never);
  app.decorate('cofid', { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
  app.decorateRequest('country', null as never);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.country = INDIA_PROFILE;
  });
  await app.register(scanRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

// Devanagari-script-free, ML-Kit-supported text so the on-device path (Step 1, where enrichment
// is wired in) is taken rather than the cloud-OCR fallback (Step 2).
const ON_DEVICE_OCR_TEXT = 'Poha\nEnergy 250 kcal\nProtein 5g\nCarbohydrates 40g';

describe('POST /v1/scans/label — Gemini enrichment (flag global.p14.gemini_label_enrichment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flag OFF (default): response is byte-identical to the pre-enrichment shape — no "enrichment" key at all', async () => {
    const app = await buildApp({ enrichmentFlagEnabled: false });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/label',
      payload: { imageBase64: 'x'.repeat(200), onDeviceOcrText: ON_DEVICE_OCR_TEXT },
    });
    const body = JSON.parse(resp.body);
    expect(body.data).not.toHaveProperty('enrichment');
    expect(Object.keys(body.data).sort()).toEqual(
      ['detectedScript', 'fieldConfidence', 'labelFormat', 'lowConfidenceFields', 'needsUserConfirmation',
        'nutrition', 'overallConfidence', 'servingSizeG', 'usedCloudOcr', 'wasPerServing'].sort(),
    );
    await app.close();
  });

  it('flag OFF: never calls the gateway at all (zero added latency/cost, not just a hidden no-op call)', async () => {
    const gatewayComplete = vi.fn(async () => ({ content: '{}' }));
    const app = await buildApp({ enrichmentFlagEnabled: false, gatewayComplete });
    await app.inject({
      method: 'POST', url: '/v1/scans/label',
      payload: { imageBase64: 'x'.repeat(200), onDeviceOcrText: ON_DEVICE_OCR_TEXT },
    });
    expect(gatewayComplete).not.toHaveBeenCalled();
    await app.close();
  });

  it('flag ON: attaches a real enrichment result, marked ai_enriched, alongside the unchanged deterministic nutrition', async () => {
    const app = await buildApp({
      enrichmentFlagEnabled: true,
      gatewayComplete: async () => ({
        content: JSON.stringify({
          foodName: 'Poha (flattened rice)', brandGuess: null,
          ingredientInterpretation: 'A rice-based breakfast dish.',
          allergenCandidates: [], servingContextNote: null,
          explanation: 'A light Indian breakfast.', confidence: 0.8,
        }),
      }),
    });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/label',
      payload: { imageBase64: 'x'.repeat(200), onDeviceOcrText: ON_DEVICE_OCR_TEXT },
    });
    const body = JSON.parse(resp.body);
    expect(body.data.enrichment.aiEnriched).toBe(true);
    expect(body.data.enrichment.foodName).toBe('Poha (flattened rice)');
    // The deterministic nutrition values are completely untouched by enrichment.
    expect(body.data.nutrition.energyKcal).toBe(250);
    await app.close();
  });

  it('flag ON but gateway unconfigured: still returns the deterministic result, no enrichment key, no error', async () => {
    const app = await buildApp({ enrichmentFlagEnabled: true, noGateway: true });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/label',
      payload: { imageBase64: 'x'.repeat(200), onDeviceOcrText: ON_DEVICE_OCR_TEXT },
    });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data).not.toHaveProperty('enrichment');
    await app.close();
  });

  it('flag ON, gateway throws: request still succeeds, deterministic nutrition untouched, enrichment reports an honest unavailable note (never silent, never a thrown error)', async () => {
    const app = await buildApp({
      enrichmentFlagEnabled: true,
      gatewayComplete: async () => { throw new Error('boom'); },
    });
    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/label',
      payload: { imageBase64: 'x'.repeat(200), onDeviceOcrText: ON_DEVICE_OCR_TEXT },
    });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.enrichment.available).toBe(false);
    expect(body.data.enrichment.aiEnriched).toBe(false);
    expect(body.data.enrichment.note).toMatch(/unavailable/i);
    expect(body.data.nutrition.energyKcal).toBe(250);
    await app.close();
  });

  it('flag ON, resolveByName itself throws (e.g. a transient DB error): route still degrades gracefully rather than 500ing', async () => {
    const { default: scanRoutes, _resetScansUnifiedFoodSchemaFlagCache, _resetGeminiLabelEnrichmentFlagCache } =
      await import('../scans.js');
    _resetScansUnifiedFoodSchemaFlagCache();
    _resetGeminiLabelEnrichmentFlagCache();

    const app = Fastify({ logger: false });
    app.decorate(
      'supabase',
      makeSupabase({ 'global.p14.gemini_label_enrichment': true, 'global.p3.unified_food_schema': true }) as never,
    );
    app.decorate('sql', vi.fn().mockRejectedValue(new Error('db down')) as never);
    app.decorate('gateway', { complete: vi.fn(async () => ({ content: '{}' })) } as never);
    app.decorate('offClient', { getProduct: vi.fn(), searchByName: vi.fn().mockResolvedValue([]) } as never);
    app.decorate('usdaClient', null as never);
    app.decorate('ifct', {
      isAvailable: () => true,
      searchByName: () => { throw new Error('ifct db down'); },
      toCanonicalProduct: vi.fn(),
    } as never);
    app.decorate('cofid', { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
    app.decorateRequest('country', null as never);
    app.addHook('onRequest', async (request: FastifyRequest) => { request.country = INDIA_PROFILE; });
    await app.register(scanRoutes, { prefix: '/v1' });
    await app.ready();

    const resp = await app.inject({
      method: 'POST', url: '/v1/scans/label',
      payload: { imageBase64: 'x'.repeat(200), onDeviceOcrText: ON_DEVICE_OCR_TEXT },
    });
    expect(resp.statusCode).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.data.nutrition.energyKcal).toBe(250);
    expect(body.data).not.toHaveProperty('enrichment');
    await app.close();
  });
});

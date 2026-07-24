import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { INDIA_PROFILE } from '../../../country/types.js';
import type { CanonicalProduct } from '../../../nutrition/canonical-model.js';

// Two dishes in one photo — multi-food expansion (production audit 2026-07): every candidate
// above the confidence floor gets nutrition, portions scale it, and the meal gets totals.
vi.mock('../../../scan/meal-photo/vision.js', () => ({
  analyseMealPhoto: vi.fn().mockResolvedValue({
    isFood: true,
    isIndianFood: true,
    sceneDescription: 'dal and rice thali',
    candidates: [
      {
        name: 'dal tadka', nameLocalised: 'दाल तड़का', confidence: 0.92, cuisine: 'North Indian',
        portionSizeHint: 'medium bowl', searchQuery: 'dal tadka cooked',
      },
      {
        name: 'rice', nameLocalised: null, confidence: 0.88, cuisine: null,
        portionSizeHint: null, searchQuery: 'rice cooked',
      },
      // Below the 0.4 floor — must be listed but NOT resolved.
      {
        name: 'unclear item', nameLocalised: null, confidence: 0.2, cuisine: null,
        portionSizeHint: null, searchQuery: 'unknown',
      },
    ],
    notes: null,
  }),
}));

function makeProduct(name: string, nutrition: Partial<CanonicalProduct['nutrition'] & object>): CanonicalProduct {
  return {
    source: 'ifct_2017', sourceId: 'x', datasetVersion: '2017', retrievedAt: new Date(),
    licenseClass: 'public_domain', barcode: null, barcodeType: null, name, brand: null,
    category: null, subCategory: null, countryOfOrigin: null, servingSizeG: null,
    servingDescription: null, packageSizeG: null, fssaiVegMark: null, imageUrl: null,
    thumbnailUrl: null, ingredientsRawText: null,
    nutrition: {
      source: 'ifct_2017', sourceId: 'x', datasetVersion: '2017', retrievedAt: new Date(),
      licenseClass: 'public_domain',
      energyKcal: null, energyKj: null, proteinG: null, fatTotalG: null, fatSaturatedG: null,
      fatTransG: null, fatPolyunsaturatedG: null, fatMonounsaturatedG: null, carbohydratesG: null,
      sugarsG: null, sugarsAddedG: null, sugarsAddedEstimated: false, dietaryFiberG: null,
      sodiumMg: null, cholesterolMg: null, calciumMg: null, ironMg: null, potassiumMg: null,
      zincMg: null, vitaminCMg: null, vitaminAIu: null, vitaminDIu: null, vitaminB12Mcg: null,
      folateMcg: null, novaGroup: null, confidence: 0.9, notes: null, ashG: null, moistureG: null,
      ...nutrition,
    },
  };
}

const DAL = makeProduct('Dal tadka', { energyKcal: 110, proteinG: 7, sodiumMg: 350, sugarsG: 12 });
const RICE = makeProduct('Rice cooked', { energyKcal: 130, proteinG: 2.7, sodiumMg: 5 });

async function buildApp(opts: { userConditions?: string[] | null } = {}): Promise<FastifyInstance> {
  const { default: scanRoutes, _resetScansUnifiedFoodSchemaFlagCache } = await import('../scans.js');
  _resetScansUnifiedFoodSchemaFlagCache();

  const app = Fastify({ logger: false });
  app.decorate('supabase', {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: (col: string) => {
          if (table === 'users_profiles') {
            return { maybeSingle: () => Promise.resolve({ data: { conditions: opts.userConditions ?? [] }, error: null }) };
          }
          return { is: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: false }, error: null }) }) };
        },
      }),
    })),
  } as never);
  const sqlFn = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO public.products')) return Promise.resolve([{ id: 'product-uuid' }]);
    if (query.includes('FROM public.data_sources')) {
      return Promise.resolve([{
        display_name: 'Indian Food Composition Tables 2017', license_class: 'public_domain',
        attribution_text: 'ICMR-NIN', terms_url: null,
      }]);
    }
    if (query.includes('FROM public.import_batches')) return Promise.resolve([{ id: 'batch-1' }]);
    return Promise.resolve([]);
  });
  (sqlFn as unknown as { json: (v: unknown) => unknown }).json = (v: unknown) => v;
  app.decorate('sql', sqlFn as never);
  app.decorate('gateway', { complete: vi.fn() } as never);
  app.decorate('offClient', {
    getProduct: vi.fn().mockResolvedValue(null),
    searchByName: vi.fn().mockResolvedValue([]),
  } as never);
  app.decorate('usdaClient', null as never);
  // IFCT resolves dal and rice, nothing for 'unknown' — the IFCT path returns canonical
  // products directly via toCanonicalProduct (no OFF-raw normalization in between), which is
  // what lets this test control exact nutrition values.
  app.decorate('ifct', {
    isAvailable: () => true,
    searchByName: vi.fn().mockImplementation((q: string) => {
      if (q.includes('dal')) return [{ key: 'dal' }];
      if (q.includes('rice')) return [{ key: 'rice' }];
      return [];
    }),
    toCanonicalProduct: vi.fn().mockImplementation((r: { key: string }) => (r.key === 'dal' ? DAL : RICE)),
  } as never);
  app.decorate('cofid', { isAvailable: () => false, searchByName: () => [], toCanonicalProduct: vi.fn() } as never);
  app.decorateRequest('country', null as never);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.country = INDIA_PROFILE;
    if (opts.userConditions !== null) {
      request.user = { id: 'user-1', role: 'authenticated' };
    }
  });
  await app.register(scanRoutes, { prefix: '/v1' });
  await app.ready();
  return app;
}

describe('POST /v1/scans/meal — multi-food nutrition, portions, totals, disease notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves nutrition for every candidate above the confidence floor, none below it', async () => {
    const app = await buildApp({ userConditions: null });
    const resp = await app.inject({ method: 'POST', url: '/v1/scans/meal', payload: { imageBase64: 'x'.repeat(200) } });
    const { data } = JSON.parse(resp.body);

    expect(data.candidates).toHaveLength(3);
    expect(data.candidates[0].nutritionPer100g.energyKcal).toBe(110);
    expect(data.candidates[1].nutritionPer100g.energyKcal).toBe(130);
    expect(data.candidates[2].nutritionPer100g).toBeNull(); // 0.2 confidence — skipped
    expect(data.candidates[0].resolvedBy).toBe('ifct_2017');
    expect(data.candidates[0].citation).not.toBeNull();
    await app.close();
  });

  it('scales per-portion nutrition from the portion estimate and sums meal totals', async () => {
    const app = await buildApp({ userConditions: null });
    const resp = await app.inject({ method: 'POST', url: '/v1/scans/meal', payload: { imageBase64: 'x'.repeat(200) } });
    const { data } = JSON.parse(resp.body);

    // dal tadka standard serving 180g × medium (1.0) = 180g → 110 kcal/100g → 198 kcal
    expect(data.candidates[0].portionEstimate.portionGrams).toBe(180);
    expect(data.candidates[0].nutritionForPortion.energyKcal).toBeCloseTo(198, 1);
    // rice standard serving 150g → 130 kcal/100g → 195 kcal
    expect(data.candidates[1].nutritionForPortion.energyKcal).toBeCloseTo(195, 1);

    expect(data.mealTotals.dishesIncluded).toBe(2);
    expect(data.mealTotals.totalPortionGrams).toBe(330);
    expect(data.mealTotals.energyKcal).toBeCloseTo(393, 1);
    expect(data.mealTotals.proteinG).toBeCloseTo(7 * 1.8 + 2.7 * 1.5, 1);
    await app.close();
  });

  it('keeps the original top-candidate fields byte-compatible', async () => {
    const app = await buildApp({ userConditions: null });
    const resp = await app.inject({ method: 'POST', url: '/v1/scans/meal', payload: { imageBase64: 'x'.repeat(200) } });
    const { data } = JSON.parse(resp.body);
    expect(data.topCandidateNutrition.energyKcal).toBe(110);
    expect(data.topCandidateResolvedBy).toBe('ifct_2017');
    expect(data.disclaimerRequired).toBe(true);
    await app.close();
  });

  it('authenticated user with conditions gets per-dish diseaseNotes and mealSuitability', async () => {
    const app = await buildApp({ userConditions: ['diabetes', 'hypertension'] });
    const resp = await app.inject({ method: 'POST', url: '/v1/scans/meal', payload: { imageBase64: 'x'.repeat(200) } });
    const { data } = JSON.parse(resp.body);

    // dal: 12g sugar → diabetes warning; 350mg sodium → hypertension warning
    const dalNotes = data.candidates[0].diseaseNotes;
    expect(dalNotes).not.toBeNull();
    expect(dalNotes.map((n: { condition: string }) => n.condition).sort()).toEqual(['diabetes', 'hypertension']);
    // rice: 5mg sodium, no sugar → nothing triggers
    expect(data.candidates[1].diseaseNotes).toBeNull();

    expect(data.mealSuitability).not.toBeNull();
    expect(['warning', 'caution', 'ok']).toContain(data.mealSuitability.overall);
    await app.close();
  });

  it('anonymous caller gets null diseaseNotes and null mealSuitability', async () => {
    const app = await buildApp({ userConditions: null });
    const resp = await app.inject({ method: 'POST', url: '/v1/scans/meal', payload: { imageBase64: 'x'.repeat(200) } });
    const { data } = JSON.parse(resp.body);
    expect(data.candidates[0].diseaseNotes).toBeNull();
    expect(data.mealSuitability).toBeNull();
    await app.close();
  });
});

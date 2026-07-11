import { describe, it, expect, vi } from 'vitest';
import { buildNutritionCitation } from '../citation.js';
import type { CanonicalProduct, NutritionPer100g } from '../canonical-model.js';

function makeSql(opts: { hasDataSource?: boolean; hasBatch?: boolean } = {}) {
  const hasDataSource = opts.hasDataSource ?? true;
  const hasBatch = opts.hasBatch ?? true;
  return vi.fn().mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join('?');
    if (query.includes('FROM public.data_sources')) {
      return Promise.resolve(hasDataSource ? [{
        display_name: 'UK Composition of Foods Integrated Dataset (CoFID)',
        license_class: 'public_domain',
        attribution_text: 'Contains public sector information licensed under the Open Government Licence v3.0.',
        terms_url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      }] : []);
    }
    if (query.includes('FROM public.import_batches')) {
      return Promise.resolve(hasBatch ? [{ id: 'batch-uuid-123' }] : []);
    }
    return Promise.resolve([]);
  }) as never;
}

function makeNutrition(overrides: Partial<NutritionPer100g> = {}): NutritionPer100g {
  return {
    source: 'cofid_2021', sourceId: 'x', datasetVersion: '2021', retrievedAt: new Date(),
    licenseClass: 'public_domain', energyKcal: 400, energyKj: null, proteinG: 25, fatTotalG: 33,
    fatSaturatedG: null, fatTransG: null, fatPolyunsaturatedG: null, fatMonounsaturatedG: null,
    carbohydratesG: 0.1, sugarsG: 0.1, sugarsAddedG: null, sugarsAddedEstimated: false,
    dietaryFiberG: null, sodiumMg: 700, cholesterolMg: null, calciumMg: null, ironMg: null,
    potassiumMg: null, zincMg: null, vitaminCMg: null, vitaminAIu: null, vitaminDIu: 12,
    vitaminB12Mcg: null, folateMcg: null, novaGroup: null, confidence: 0.95, notes: null,
    ashG: null, moistureG: null,
    ...overrides,
  };
}

function makeProduct(nutrition: NutritionPer100g | null): CanonicalProduct {
  return {
    source: 'cofid_2021', sourceId: 'x-13-145', datasetVersion: '2021', retrievedAt: new Date(),
    licenseClass: 'public_domain', barcode: null, barcodeType: null, name: 'Ackee, canned, drained',
    brand: null, category: null, subCategory: null, countryOfOrigin: 'united_kingdom',
    servingSizeG: null, servingDescription: null, packageSizeG: null, fssaiVegMark: null,
    imageUrl: null, thumbnailUrl: null, nutrition, ingredientsRawText: null,
  };
}

describe('buildNutritionCitation', () => {
  it('returns null when the product has no nutrition data at all', async () => {
    const citation = await buildNutritionCitation(makeSql(), makeProduct(null));
    expect(citation).toBeNull();
  });

  it('returns null when the data_sources row is missing (never fabricates a fallback)', async () => {
    const citation = await buildNutritionCitation(makeSql({ hasDataSource: false }), makeProduct(makeNutrition()));
    expect(citation).toBeNull();
  });

  it('builds a real citation from data_sources + import_batches, with grade A for high-confidence government data', async () => {
    const citation = await buildNutritionCitation(makeSql(), makeProduct(makeNutrition()));
    expect(citation).toEqual({
      source: 'cofid_2021',
      sourceDisplay: 'UK Composition of Foods Integrated Dataset (CoFID)',
      licenseClass: 'public_domain',
      attributionText: 'Contains public sector information licensed under the Open Government Licence v3.0.',
      termsUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      datasetVersion: '2021',
      importBatchId: 'batch-uuid-123',
      sourceFoodId: 'x-13-145',
      dataQualityGrade: 'A',
      valueStateNotes: [],
    });
  });

  it('importBatchId is null (not fabricated) when no completed batch exists — e.g. a live-API source like USDA', async () => {
    const citation = await buildNutritionCitation(makeSql({ hasBatch: false }), makeProduct(makeNutrition()));
    expect(citation?.importBatchId).toBeNull();
  });

  it('surfaces an estimated-value note for a nutrient the source explicitly flags, and only that state', async () => {
    const nutrition = makeNutrition({
      nutrientValueState: {
        vitaminDIu: 'estimated',
        ironMg: 'not_analyzed',
        zincMg: 'trace',
      },
    });
    const citation = await buildNutritionCitation(makeSql(), makeProduct(nutrition));
    expect(citation?.valueStateNotes).toEqual(['vitaminDIu is an estimated value (flagged by the source)']);
  });

  it('grades a low-confidence product C, and a missing-confidence non-open-licence product C', async () => {
    const lowConfidence = await buildNutritionCitation(makeSql(), makeProduct(makeNutrition({ confidence: 0.5 })));
    expect(lowConfidence?.dataQualityGrade).toBe('C');

    const noConfidence = await buildNutritionCitation(makeSql(), makeProduct(makeNutrition({ confidence: null, licenseClass: 'licensed_restricted' })));
    expect(noConfidence?.dataQualityGrade).toBe('C');
  });
});

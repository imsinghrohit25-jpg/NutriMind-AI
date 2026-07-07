import { describe, it, expect } from 'vitest';
import { normalizeOffProduct } from '../openfoodfacts/normalize.js';
import type { OFFProduct } from '../openfoodfacts/client.js';

const SAMPLE_PRODUCT: OFFProduct = {
  _id: '8901030924617',
  product_name_en: 'Maggi 2-Minute Noodles Masala',
  product_name: 'Maggi 2-Minute Noodles Masala',
  brands: 'Maggi, Nestlé',
  categories_tags: ['en:instant-noodles', 'en:pastas'],
  sub_categories_tags: ['en:instant-noodles'],
  countries_tags: ['en:india'],
  image_url: 'https://images.openfoodfacts.org/test.jpg',
  image_small_url: 'https://images.openfoodfacts.org/test_small.jpg',
  serving_size: '70g',
  quantity: '420 g',
  nova_group: 4,
  labels_tags: ['en:vegetarian'],
  ingredients_text_en: 'Wheat flour, Edible vegetable oil, Salt, Masala tastemaker',
  nutriments: {
    'energy-kcal_100g': 377,
    'energy-kj_100g': 1576,
    proteins_100g: 9.1,
    fat_100g: 15.7,
    'saturated-fat_100g': 7.6,
    'trans-fat_100g': 0,
    carbohydrates_100g: 50.3,
    sugars_100g: 2.1,
    fiber_100g: 1.4,
    sodium_100g: 0.0013,  // g/100g → 1.3 mg/100g
    iron_100g: 0.0022,    // g/100g → 2.2 mg/100g
  },
};

describe('normalizeOffProduct', () => {
  it('maps product name correctly', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.name).toBe('Maggi 2-Minute Noodles Masala');
  });

  it('picks first brand from comma-separated list', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.brand).toBe('Maggi');
  });

  it('sets provenance fields correctly', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.source).toBe('openfoodfacts');
    expect(product.sourceId).toBe('8901030924617');
    expect(product.datasetVersion).toBe('live');
    expect(product.licenseClass).toBe('odbl');
  });

  it('detects barcode type as EAN-13', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.barcodeType).toBe('ean13');
  });

  it('maps macronutrients per 100g', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    const n = product.nutrition!;
    expect(n.energyKcal).toBe(377);
    expect(n.proteinG).toBe(9.1);
    expect(n.fatTotalG).toBe(15.7);
    expect(n.carbohydratesG).toBe(50.3);
  });

  it('converts sodium from g/100g to mg/100g', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.nutrition!.sodiumMg).toBeCloseTo(1.3, 1);
  });

  it('converts iron from g/100g to mg/100g', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.nutrition!.ironMg).toBeCloseTo(2.2, 1);
  });

  it('estimates added sugar from total sugars when not provided (ADR-0007)', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    const n = product.nutrition!;
    expect(n.sugarsAddedG).toBe(2.1);
    expect(n.sugarsAddedEstimated).toBe(true);
  });

  it('uses direct added sugar when provided', () => {
    const productWithAdded: OFFProduct = {
      ...SAMPLE_PRODUCT,
      nutriments: { ...SAMPLE_PRODUCT.nutriments, 'added-sugars_100g': 1.5 },
    };
    const result = normalizeOffProduct(productWithAdded);
    expect(result.nutrition!.sugarsAddedG).toBe(1.5);
    expect(result.nutrition!.sugarsAddedEstimated).toBe(false);
  });

  it('sets NOVA group', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.nutrition!.novaGroup).toBe(4);
  });

  it('rejects invalid NOVA group values', () => {
    const p: OFFProduct = { ...SAMPLE_PRODUCT, nova_group: 5 };
    expect(normalizeOffProduct(p).nutrition!.novaGroup).toBeNull();
  });

  it('infers vegetarian mark from labels', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.fssaiVegMark).toBe('green');
  });

  it('parses serving size', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.servingSizeG).toBe(70);
  });

  it('parses package size', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.packageSizeG).toBe(420);
  });

  it('maps country of origin from countries_tags', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.countryOfOrigin).toBe('india');
  });

  it('preserves ingredients text', () => {
    const product = normalizeOffProduct(SAMPLE_PRODUCT);
    expect(product.ingredientsRawText).toContain('Wheat flour');
  });

  it('fills energyKj when absent but energyKcal present', () => {
    const p: OFFProduct = {
      ...SAMPLE_PRODUCT,
      nutriments: { ...SAMPLE_PRODUCT.nutriments, 'energy-kj_100g': undefined },
    };
    const result = normalizeOffProduct(p);
    // Should fill from kcal: 377 kcal × 4.184 ≈ 1577
    expect(result.nutrition!.energyKj).toBeCloseTo(1577, 0);
  });
});

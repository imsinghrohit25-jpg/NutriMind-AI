// Normalize an OpenFoodFacts product response into a CanonicalProduct.
// Unit conventions per OFF field spec:
//   macros (protein/fat/carbs/fiber): g/100g
//   sodium/cholesterol/calcium/iron/potassium/zinc: g/100g → convert ×1000 to mg
//   vitamins: mg/100g for vitamin-c; mcg/100g for vitamin-a (RAE) and vitamin-d; mcg for b12/folate

import type { OFFProduct } from './client.js';
import type { CanonicalProduct, NutritionPer100g } from '../../nutrition/canonical-model.js';
import { detectBarcodeType, parseServingSizeG, parsePackageSizeG, vitaminARaeToIu, vitaminDMcgToIu } from '../../nutrition/units.js';
import { estimateAddedSugar, energyConsistencyNote, fillEnergyFields } from '../../nutrition/derived.js';
import { OFF_ATTRIBUTION } from './attribution.js';

function n(v: number | undefined): number | null {
  return v !== undefined && isFinite(v) ? v : null;
}

// g/100g → mg/100g
function gToMg(v: number | undefined): number | null {
  const val = n(v);
  return val !== null ? val * 1000 : null;
}

function firstNonEmpty(...candidates: (string | undefined)[]): string | null {
  for (const c of candidates) {
    const s = c?.trim();
    if (s) return s;
  }
  return null;
}

function pickCategory(tags: string[] | undefined): string | null {
  if (!tags?.length) return null;
  // Strip language prefix (e.g. "en:beverages" → "beverages"), prefer first tag
  const raw = tags[0] ?? '';
  return raw.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ') || null;
}

function inferVegMark(labelsTags: string[] | undefined): 'green' | 'red' | 'unknown' | null {
  if (!labelsTags?.length) return null;
  const tags = labelsTags.map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes('vegan') || t.includes('vegetarian'))) return 'green';
  if (tags.some((t) => t.includes('non-vegetarian') || t.includes('meat') || t.includes('fish'))) return 'red';
  return 'unknown';
}

function countryOfOrigin(countriesTags: string[] | undefined): string | null {
  if (!countriesTags?.length) return null;
  const raw = countriesTags[0] ?? '';
  return raw.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ') || null;
}

export function normalizeOffProduct(product: OFFProduct): CanonicalProduct {
  const nm = product.nutriments ?? {};
  const now = new Date();
  const prov = {
    source: OFF_ATTRIBUTION.dataSourceId,
    sourceId: product._id,
    datasetVersion: 'live',
    retrievedAt: now,
    licenseClass: OFF_ATTRIBUTION.licenseClass,
  };

  const sugarsG = n(nm.sugars_100g);
  const { sugarsAddedG, sugarsAddedEstimated } = estimateAddedSugar(nm['added-sugars_100g'], sugarsG);

  const energyKcal = n(nm['energy-kcal_100g']);
  const proteinG = n(nm.proteins_100g);
  const fatTotalG = n(nm.fat_100g);
  const carbohydratesG = n(nm.carbohydrates_100g);

  const consistencyNote = energyConsistencyNote(energyKcal, proteinG, fatTotalG, carbohydratesG);

  const novaRaw = product.nova_group;
  const novaGroup =
    novaRaw === 1 || novaRaw === 2 || novaRaw === 3 || novaRaw === 4 ? novaRaw : null;

  const nutrition: NutritionPer100g = {
    ...prov,
    energyKcal,
    energyKj: n(nm['energy-kj_100g']),
    proteinG,
    fatTotalG,
    fatSaturatedG: n(nm['saturated-fat_100g']),
    fatTransG: n(nm['trans-fat_100g']),
    fatPolyunsaturatedG: n(nm['polyunsaturated-fat_100g']),
    fatMonounsaturatedG: n(nm['monounsaturated-fat_100g']),
    carbohydratesG,
    sugarsG,
    sugarsAddedG,
    sugarsAddedEstimated,
    dietaryFiberG: n(nm.fiber_100g),
    sodiumMg: gToMg(nm.sodium_100g),
    cholesterolMg: gToMg(nm.cholesterol_100g),
    calciumMg: gToMg(nm.calcium_100g),
    ironMg: gToMg(nm.iron_100g),
    potassiumMg: gToMg(nm.potassium_100g),
    zincMg: gToMg(nm.zinc_100g),
    vitaminCMg: n(nm['vitamin-c_100g']),
    vitaminAIu: nm['vitamin-a_100g'] != null ? vitaminARaeToIu(nm['vitamin-a_100g']) : null,
    vitaminDIu: nm['vitamin-d_100g'] != null ? vitaminDMcgToIu(nm['vitamin-d_100g']) : null,
    vitaminB12Mcg: n(nm['vitamin-b12_100g']),
    folateMcg: n(nm.folate_100g),
    novaGroup,
    confidence: null,
    notes: consistencyNote,
  };

  fillEnergyFields(nutrition);

  const barcode = product._id;
  const name = firstNonEmpty(product.product_name_en, product.product_name) ?? 'Unknown Product';
  const brand = firstNonEmpty(product.brands?.split(',')[0]);
  const servingSizeG = parseServingSizeG(product.serving_size);
  const packageSizeG = parsePackageSizeG(product.quantity);

  return {
    ...prov,
    barcode,
    barcodeType: barcode ? detectBarcodeType(barcode) : null,
    name,
    brand,
    category: pickCategory(product.categories_tags),
    subCategory: pickCategory(product.sub_categories_tags),
    countryOfOrigin: countryOfOrigin(product.countries_tags),
    servingSizeG,
    servingDescription: product.serving_size ?? null,
    packageSizeG,
    fssaiVegMark: inferVegMark(product.labels_tags),
    imageUrl: product.image_url ?? null,
    thumbnailUrl: product.image_small_url ?? null,
    nutrition,
    ingredientsRawText: firstNonEmpty(product.ingredients_text_en, product.ingredients_text),
  };
}

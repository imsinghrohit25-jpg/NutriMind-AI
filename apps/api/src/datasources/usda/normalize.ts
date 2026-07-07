// Normalize a USDA FoodData Central food detail into a CanonicalProduct.
// USDA nutrient IDs: https://fdc.nal.usda.gov/fdc-app.html#/?query=nutrients
// All units as returned by FDC (g, mg, mcg, IU, kcal); unit is in nutrient.unitName.

import type { UsdaFoodDetail } from './client.js';
import type { CanonicalProduct, NutritionPer100g } from '../../nutrition/canonical-model.js';
import { vitaminARaeToIu } from '../../nutrition/units.js';
import { estimateAddedSugar, energyConsistencyNote, fillEnergyFields } from '../../nutrition/derived.js';

// FDC nutrient IDs used by NutriMind.
const NID = {
  energyKcal: 1008,
  protein: 1003,
  fatTotal: 1004,
  fatSaturated: 1258,
  fatTrans: 1257,
  fatPolyunsat: 1292,
  fatMonounsat: 1293,
  carbohydrates: 1005,
  sugarsTotal: 2000,
  fiber: 1079,
  sodium: 1093,       // mg
  cholesterol: 1253,  // mg
  calcium: 1087,      // mg
  iron: 1089,         // mg
  potassium: 1092,    // mg
  zinc: 1095,         // mg
  vitaminC: 1162,     // mg
  vitaminARae: 1106,  // mcg RAE → convert to IU
  vitaminDIu: 1114,   // IU
  vitaminB12: 1178,   // mcg
  folate: 1177,       // mcg
} as const;

function extractNutrient(
  nutrients: UsdaFoodDetail['foodNutrients'],
  id: number,
): number | null {
  const entry = nutrients.find((n) => n.nutrient.id === id);
  return entry != null && isFinite(entry.amount) ? entry.amount : null;
}

export function normalizeUsdaFood(food: UsdaFoodDetail): CanonicalProduct {
  const n = food.foodNutrients;
  const now = new Date();
  const prov = {
    source: 'usda_fdc',
    sourceId: String(food.fdcId),
    datasetVersion: food.dataType,
    retrievedAt: now,
    licenseClass: 'public_domain',
  };

  const energyKcal = extractNutrient(n, NID.energyKcal);
  const proteinG = extractNutrient(n, NID.protein);
  const fatTotalG = extractNutrient(n, NID.fatTotal);
  const carbohydratesG = extractNutrient(n, NID.carbohydrates);
  const sugarsG = extractNutrient(n, NID.sugarsTotal);
  const vitaminARae = extractNutrient(n, NID.vitaminARae);

  const { sugarsAddedG, sugarsAddedEstimated } = estimateAddedSugar(undefined, sugarsG);
  const consistencyNote = energyConsistencyNote(energyKcal, proteinG, fatTotalG, carbohydratesG);

  const nutrition: NutritionPer100g = {
    ...prov,
    energyKcal,
    energyKj: null,
    proteinG,
    fatTotalG,
    fatSaturatedG: extractNutrient(n, NID.fatSaturated),
    fatTransG: extractNutrient(n, NID.fatTrans),
    fatPolyunsaturatedG: extractNutrient(n, NID.fatPolyunsat),
    fatMonounsaturatedG: extractNutrient(n, NID.fatMonounsat),
    carbohydratesG,
    sugarsG,
    sugarsAddedG,
    sugarsAddedEstimated,
    dietaryFiberG: extractNutrient(n, NID.fiber),
    sodiumMg: extractNutrient(n, NID.sodium),
    cholesterolMg: extractNutrient(n, NID.cholesterol),
    calciumMg: extractNutrient(n, NID.calcium),
    ironMg: extractNutrient(n, NID.iron),
    potassiumMg: extractNutrient(n, NID.potassium),
    zincMg: extractNutrient(n, NID.zinc),
    vitaminCMg: extractNutrient(n, NID.vitaminC),
    vitaminAIu: vitaminARae !== null ? vitaminARaeToIu(vitaminARae) : null,
    vitaminDIu: extractNutrient(n, NID.vitaminDIu),
    vitaminB12Mcg: extractNutrient(n, NID.vitaminB12),
    folateMcg: extractNutrient(n, NID.folate),
    novaGroup: null,  // FDC does not provide NOVA classification
    confidence: 0.9,  // Foundation / SR Legacy data is high-confidence reference data
    notes: consistencyNote,
  };

  fillEnergyFields(nutrition);

  const firstPortion = food.foodPortions?.[0];
  const servingSizeG = food.servingSize ?? firstPortion?.gramWeight ?? null;
  const servingDescription = firstPortion
    ? `${firstPortion.amount} ${firstPortion.modifier}`
    : food.servingSizeUnit
      ? `${food.servingSize} ${food.servingSizeUnit}`
      : null;

  return {
    ...prov,
    barcode: null,  // USDA FDC foods are not barcoded
    barcodeType: null,
    name: food.description,
    brand: food.brandOwner ?? food.brandName ?? null,
    category: food.dataType,
    subCategory: null,
    countryOfOrigin: null,
    servingSizeG,
    servingDescription,
    packageSizeG: null,
    fssaiVegMark: null,
    imageUrl: null,
    thumbnailUrl: null,
    nutrition,
    ingredientsRawText: food.ingredients ?? null,
  };
}

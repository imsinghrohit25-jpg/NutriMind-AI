// CoFID → CanonicalProduct normalizer.
// CoFID uses μg for Vitamin A (RAE) and Vitamin D; convert to IU for schema compatibility.
// CoFID does not provide NOVA group or added sugars — set to null.

import type { CanonicalProduct, NutritionPer100g } from '../../nutrition/canonical-model.js';
import type { CofidFood } from './loader.js';

// 1 μg RAE = 3.33 IU Vitamin A
const RAE_TO_IU_A = 3.33;
// 1 μg Vitamin D = 40 IU
const MCG_TO_IU_D = 40;
// 1 mg Sodium = 1 mg (no conversion needed)
// Vitamin B12 and Folate: CoFID uses μg, schema uses μg — no conversion

export function normalizeCofidFood(food: CofidFood): CanonicalProduct {
  const nutrition: NutritionPer100g = {
    source: 'cofid_2021',
    sourceId: food.food_code,
    datasetVersion: '2021',
    retrievedAt: new Date(),
    licenseClass: 'public_domain',

    energyKcal: food.energy_kcal,
    energyKj: food.energy_kj,
    proteinG: food.protein_g,
    fatTotalG: food.fat_g,
    fatSaturatedG: food.saturated_fat_g,
    fatTransG: food.trans_fat_g,
    fatPolyunsaturatedG: null,
    fatMonounsaturatedG: null,
    carbohydratesG: food.carbohydrate_g,
    sugarsG: food.total_sugars_g,
    sugarsAddedG: null,               // CoFID does not distinguish added sugars
    sugarsAddedEstimated: false,
    dietaryFiberG: food.dietary_fibre_g,
    sodiumMg: food.sodium_mg,
    cholesterolMg: null,
    calciumMg: food.calcium_mg,
    ironMg: food.iron_mg,
    potassiumMg: food.potassium_mg,
    zincMg: food.zinc_mg,
    vitaminCMg: food.vitamin_c_mg,
    vitaminAIu: food.vitamin_a_ug != null ? parseFloat((food.vitamin_a_ug * RAE_TO_IU_A).toFixed(2)) : null,
    vitaminDIu: food.vitamin_d_ug != null ? parseFloat((food.vitamin_d_ug * MCG_TO_IU_D).toFixed(2)) : null,
    vitaminB12Mcg: food.vitamin_b12_ug,
    folateMcg: food.folate_ug,
    novaGroup: null,   // CoFID does not classify NOVA; engine will assign later
    confidence: 0.95,  // CoFID is a government-authoritative source
    notes: 'CoFID 2021 — UK government food composition dataset',
  };

  return {
    source: 'cofid_2021',
    sourceId: food.food_code,
    datasetVersion: '2021',
    retrievedAt: new Date(),
    licenseClass: 'public_domain',

    barcode: null,
    barcodeType: null,
    name: food.food_name,
    brand: null,
    category: food.food_group ?? null,
    subCategory: null,
    countryOfOrigin: 'GB',
    servingSizeG: null,
    servingDescription: null,
    packageSizeG: null,
    fssaiVegMark: null,
    imageUrl: null,
    thumbnailUrl: null,
    nutrition,
    ingredientsRawText: null,
    countryCodes: ['GB', 'IE'],
    sourceRegion: 'GB',
  };
}

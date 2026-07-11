// Builds a CanonicalProduct from one joined CoFID food record — ADR-0033. Replaces the original
// placeholder-era normalizer (which mapped a flat, hand-typed `CofidFood` — never populated by any
// real data, since `data/cofid/cofid.json` never existed) now that the real workbook is available.
//
// CoFID's own "Description" column is deliberately NEVER treated as an alternate food name — direct
// inspection of the real workbook shows it holds sample/provenance text ("8 cans", "Literature
// sources", "10 samples, 4 brands"), not a synonym, so product_aliases is never populated from it
// (ADR-0033). CoFID's "Group" is stored as its own raw code with no separate display name — this
// workbook edition ships no group-code-to-English-name lookup sheet anywhere (verified: the "List
// of tables" sheet is a table of contents, not a dictionary) — fabricating label text from external
// memory rather than the verified source file would violate the master prompt's own data-honesty
// rule, so the raw code is used as both `food_groups.code` and `display_name`.

import type { CanonicalProduct, NutritionPer100g, NutrientValueState } from '../../nutrition/canonical-model.js';
import { estimateAddedSugar, energyConsistencyNote, fillEnergyFields } from '../../nutrition/derived.js';
import { vitaminARaeToIu, vitaminDMcgToIu } from '../../nutrition/units.js';
import { COFID_DEDICATED_FIELD_MAP, COFID_VITAMIN_A_RAE_TAG, COFID_VITAMIN_D_MCG_TAG, type DedicatedField } from './nutrient-map.js';
import { parseCofidValue } from './validate.js';
import type { CofidDataset } from './xlsx-loader.js';
import type { CofidFoodRow } from './types.js';

export const COFID_SOURCE_ID = 'cofid_2021';

export function normalizeCofidFood(food: CofidFoodRow, dataset: CofidDataset): CanonicalProduct {
  const now = new Date();
  const prov = {
    source: COFID_SOURCE_ID,
    sourceId: food.foodCode,
    datasetVersion: dataset.datasetVersion,
    retrievedAt: now,
    licenseClass: 'public_domain',
  };

  const raw = dataset.nutrientsByFood.get(food.foodCode) ?? {};
  const dedicated: Partial<Record<DedicatedField, number>> = {};
  const nutrientExtra: Record<string, number> = {};
  const nutrientValueState: Record<string, NutrientValueState> = {};
  const symbolTally: Record<string, number> = {}; // discarded here — validate.ts owns the real tally
  let retinolEquivalentMcg: number | null = null;
  let vitaminDMcg: number | null = null;

  for (const [tag, cellRaw] of Object.entries(raw)) {
    const { value, state } = parseCofidValue(cellRaw, symbolTally);

    if (tag === COFID_VITAMIN_A_RAE_TAG) {
      retinolEquivalentMcg = value;
      nutrientValueState.vitaminAIu = state;
      continue;
    }
    if (tag === COFID_VITAMIN_D_MCG_TAG) {
      vitaminDMcg = value;
      nutrientValueState.vitaminDIu = state;
      continue;
    }

    const dedicatedField = COFID_DEDICATED_FIELD_MAP[tag];
    const key = dedicatedField ?? tag;
    if (dedicatedField) {
      if (value !== null) dedicated[dedicatedField] = value;
    } else if (value !== null) {
      nutrientExtra[key] = value;
    }
    nutrientValueState[key] = state;
  }

  const proteinG = dedicated.proteinG ?? null;
  const fatTotalG = dedicated.fatTotalG ?? null;
  const carbohydratesG = dedicated.carbohydratesG ?? null;
  const sugarsG = dedicated.sugarsG ?? null;
  const energyKcalReported = dedicated.energyKcal ?? null;

  const { sugarsAddedG, sugarsAddedEstimated } = estimateAddedSugar(undefined, sugarsG);
  const note = energyConsistencyNote(energyKcalReported, proteinG, fatTotalG, carbohydratesG);

  const vitaminAIu = dedicated.vitaminAIu ?? (retinolEquivalentMcg !== null ? vitaminARaeToIu(retinolEquivalentMcg) : null);
  const vitaminDIu = dedicated.vitaminDIu ?? (vitaminDMcg !== null ? vitaminDMcgToIu(vitaminDMcg) : null);

  const nutrition: NutritionPer100g = {
    ...prov,
    energyKcal: energyKcalReported,
    energyKj: dedicated.energyKj ?? null,
    proteinG,
    fatTotalG,
    fatSaturatedG: dedicated.fatSaturatedG ?? null,
    fatTransG: dedicated.fatTransG ?? null,
    fatPolyunsaturatedG: dedicated.fatPolyunsaturatedG ?? null,
    fatMonounsaturatedG: dedicated.fatMonounsaturatedG ?? null,
    carbohydratesG,
    sugarsG,
    sugarsAddedG,
    sugarsAddedEstimated,
    dietaryFiberG: dedicated.dietaryFiberG ?? null,
    sodiumMg: dedicated.sodiumMg ?? null,
    cholesterolMg: dedicated.cholesterolMg ?? null,
    calciumMg: dedicated.calciumMg ?? null,
    ironMg: dedicated.ironMg ?? null,
    potassiumMg: dedicated.potassiumMg ?? null,
    zincMg: dedicated.zincMg ?? null,
    vitaminCMg: dedicated.vitaminCMg ?? null,
    vitaminAIu,
    vitaminDIu,
    vitaminB12Mcg: dedicated.vitaminB12Mcg ?? null,
    folateMcg: dedicated.folateMcg ?? null,
    novaGroup: null, // CoFID does not provide a NOVA classification
    confidence: 0.95, // Public Health England / OHID government lab data — high-confidence reference
    notes: note,
    ashG: dedicated.ashG ?? null,
    moistureG: dedicated.moistureG ?? null,
    nutrientValueState: Object.keys(nutrientValueState).length > 0 ? nutrientValueState : undefined,
    nutrientExtra: Object.keys(nutrientExtra).length > 0 ? nutrientExtra : undefined,
    // CoFID reports no standard-error/SD column in the 4 imported sheets (unlike CNF's STD_Error)
    // — nutrientSd is intentionally left unset, never fabricated.
  };

  fillEnergyFields(nutrition);

  const product: CanonicalProduct = {
    ...prov,
    barcode: null,
    barcodeType: null,
    name: food.foodName,
    brand: null,
    category: food.groupCode || null,
    subCategory: null,
    countryOfOrigin: 'united_kingdom',
    servingSizeG: null,
    servingDescription: null,
    packageSizeG: null,
    fssaiVegMark: null,
    imageUrl: null,
    thumbnailUrl: null,
    nutrition,
    ingredientsRawText: null,
    countryCodes: ['GB'],
    sourceRegion: 'GB',
  };

  return product;
}

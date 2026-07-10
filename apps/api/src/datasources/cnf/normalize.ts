// Builds a CanonicalProduct (+ real portions + real French alias) from one joined CNF food record
// — ADR-0032. Verified directly: `Nutrient_Amount.csv` never contains a blank amount (0 blank rows
// across all 565,409 real rows) — a nutrient's ABSENCE from a food's row set is CNF's own "not
// analyzed" signal (matches this codebase's existing value_state convention from the IFCT
// integration), while a present row with amount=0 is a real, confirmed zero measurement (199,662
// such rows exist) — never conflated.

import type { CanonicalProduct, NutritionPer100g, NutrientValueState } from '../../nutrition/canonical-model.js';
import { estimateAddedSugar, energyConsistencyNote, fillEnergyFields } from '../../nutrition/derived.js';
import { vitaminARaeToIu } from '../../nutrition/units.js';
import { CNF_DEDICATED_FIELD_MAP, CNF_VITAMIN_A_RAE_CODE, type DedicatedField } from './nutrient-map.js';
import { CNF_MEASURE_TYPE, type CnfDataset } from './loader.js';
import type { CnfFoodNameRow } from './types.js';

export const CNF_SOURCE_ID = 'cnf_2026';

export interface CnfPortionRecord {
  measureType: 'household' | 'yield' | 'refuse';
  descriptionEn: string;
  descriptionFr: string | null;
  value: number;
  valueUnit: 'g' | 'pct';
  sourceMeasureId: string;
}

export interface CnfAliasRecord {
  languageCode: string;
  aliasName: string;
  aliasType: 'translation' | 'alternate' | 'scientific';
}

export interface CnfNormalizedFood {
  foodCode: string;
  product: CanonicalProduct;
  portions: CnfPortionRecord[];
  aliases: CnfAliasRecord[];
}

function toGramsOrPct(measureTypeCode: string, raw: string): { unit: 'g' | 'pct'; value: number } {
  const value = Number(raw);
  return measureTypeCode === CNF_MEASURE_TYPE.REFUSE ? { unit: 'pct', value } : { unit: 'g', value };
}

function measureTypeLabel(code: string): 'household' | 'yield' | 'refuse' {
  if (code === CNF_MEASURE_TYPE.REFUSE) return 'refuse';
  if (code === CNF_MEASURE_TYPE.YIELD) return 'yield';
  return 'household';
}

export function normalizeCnfFood(food: CnfFoodNameRow, dataset: CnfDataset): CnfNormalizedFood {
  const now = new Date();
  const prov = {
    source: CNF_SOURCE_ID,
    sourceId: food.foodCode,
    datasetVersion: '2026',
    retrievedAt: now,
    licenseClass: 'public_domain',
  };

  const amounts = dataset.nutrientAmountsByFood.get(food.foodCode) ?? [];
  const dedicated: Partial<Record<DedicatedField, number>> = {};
  const nutrientExtra: Record<string, number> = {};
  const nutrientSd: Record<string, number> = {};
  const nutrientValueState: Record<string, NutrientValueState> = {};
  let retinolActivityEquivalentMcg: number | null = null;

  for (const row of amounts) {
    const value = Number(row.amount);
    const sd = row.stdError !== '' ? Number(row.stdError) : null;
    const state: NutrientValueState = value === 0 ? 'zero' : 'measured';

    if (row.nutrientCode === CNF_VITAMIN_A_RAE_CODE) {
      retinolActivityEquivalentMcg = value;
      nutrientValueState.vitaminAIu = state;
      if (sd !== null && sd !== 0) nutrientSd.vitaminAIu = sd;
      continue;
    }

    const dedicatedField = CNF_DEDICATED_FIELD_MAP[row.nutrientCode];
    const nutrientInfo = dataset.nutrientNames.get(row.nutrientCode);
    // A blank Tagname is real (verified: 6 real CNF nutrient codes — 573, 578, 904, 907, 910, 911
    // — share an empty Tagname in Nutrient_Name.csv) and `??` only falls through on null/undefined,
    // not on '' — always fall back to the code-based key when the tagname is empty, or six
    // genuinely distinct nutrients would silently collide under the same nutrient_extra key.
    const tagname = nutrientInfo?.tagname;
    const key = dedicatedField ?? (tagname && tagname.length > 0 ? tagname : `cnf_${row.nutrientCode}`);

    if (dedicatedField) {
      dedicated[dedicatedField] = value;
    } else {
      nutrientExtra[key] = value;
    }
    nutrientValueState[key] = state;
    if (sd !== null && sd !== 0) nutrientSd[key] = sd;
  }

  const proteinG = dedicated.proteinG ?? null;
  const fatTotalG = dedicated.fatTotalG ?? null;
  const carbohydratesG = dedicated.carbohydratesG ?? null;
  const sugarsG = dedicated.sugarsG ?? null;
  const energyKcalReported = dedicated.energyKcal ?? null;

  const { sugarsAddedG, sugarsAddedEstimated } = estimateAddedSugar(undefined, sugarsG);
  const note = energyConsistencyNote(energyKcalReported, proteinG, fatTotalG, carbohydratesG);

  // Vitamin A: prefer the dedicated field if CNF happened to report it under a different code
  // (it doesn't, in this release — RAE is the only real source), else derive from RAE via the
  // same mcg-RAE -> IU factor USDA's own normalizer already uses (never a duplicated formula).
  const vitaminAIu = dedicated.vitaminAIu ?? (retinolActivityEquivalentMcg !== null ? vitaminARaeToIu(retinolActivityEquivalentMcg) : null);

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
    vitaminDIu: dedicated.vitaminDIu ?? null,
    vitaminB12Mcg: dedicated.vitaminB12Mcg ?? null,
    folateMcg: dedicated.folateMcg ?? null,
    novaGroup: null, // CNF does not provide a NOVA classification
    confidence: 0.92, // Health Canada government lab data — high-confidence reference data
    notes: note,
    ashG: dedicated.ashG ?? null,
    moistureG: dedicated.moistureG ?? null,
    nutrientSd: Object.keys(nutrientSd).length > 0 ? nutrientSd : undefined,
    nutrientValueState: Object.keys(nutrientValueState).length > 0 ? nutrientValueState : undefined,
    nutrientExtra: Object.keys(nutrientExtra).length > 0 ? nutrientExtra : undefined,
  };

  fillEnergyFields(nutrition);

  const foodGroup = dataset.foodGroups.get(food.foodGroupCode);

  const product: CanonicalProduct = {
    ...prov,
    barcode: null,
    barcodeType: null,
    name: food.descriptionEn,
    brand: null,
    category: foodGroup?.nameEn ?? null,
    subCategory: null,
    countryOfOrigin: 'canada',
    servingSizeG: null,
    servingDescription: null,
    packageSizeG: null,
    fssaiVegMark: null,
    imageUrl: null,
    thumbnailUrl: null,
    nutrition,
    ingredientsRawText: null,
  };

  const portions: CnfPortionRecord[] = (dataset.portionsByFood.get(food.foodCode) ?? [])
    .map((p) => {
      const measureName = dataset.measureNames.get(p.measureCode);
      const { unit, value } = toGramsOrPct(p.measureTypeCode, p.value);
      if (!isFinite(value)) return null;
      return {
        measureType: measureTypeLabel(p.measureTypeCode),
        descriptionEn: measureName?.descriptionEn ?? `measure ${p.measureCode}`,
        descriptionFr: measureName?.descriptionFr ?? null,
        value,
        valueUnit: unit,
        sourceMeasureId: p.measureCode,
      } satisfies CnfPortionRecord;
    })
    .filter((p): p is CnfPortionRecord => p !== null);

  const aliases: CnfAliasRecord[] = [];
  if (food.descriptionFr) {
    aliases.push({ languageCode: 'fr', aliasName: food.descriptionFr, aliasType: 'translation' });
  }
  if (food.alternateDescriptionEn) {
    aliases.push({ languageCode: 'en', aliasName: food.alternateDescriptionEn, aliasType: 'alternate' });
  }
  if (food.alternateDescriptionFr) {
    aliases.push({ languageCode: 'fr', aliasName: food.alternateDescriptionFr, aliasType: 'alternate' });
  }
  if (food.scientificName) {
    aliases.push({ languageCode: 'la', aliasName: food.scientificName, aliasType: 'scientific' });
  }

  return { foodCode: food.foodCode, product, portions, aliases };
}

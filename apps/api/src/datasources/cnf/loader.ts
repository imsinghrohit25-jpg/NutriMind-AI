// CNF relational dataset loader — ADR-0032. Loads all 7 real CNF files and joins them by their
// real numeric IDs (Food_Code, Nutrient_Code, Measure_Code, Food_Group_Code) — never assumes a
// flat single-table structure. Every join target is verified to resolve (referential integrity
// is checked in `validate.ts`, not silently assumed here).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRows } from './csv-loader.js';
import {
  CNF_MEASURE_TYPE,
  type CnfFoodGroupRow, type CnfFoodNameRow, type CnfFoodSourceRow, type CnfMeasureNameRow,
  type CnfMeasureWeightConversionRow, type CnfNutrientAmountRow, type CnfNutrientNameRow,
  type CnfNutrientSourceRow,
} from './types.js';

const CNF_FILES = {
  foodGroup: 'CNF_Food_Group.csv',
  foodName: 'Food_Name.csv',
  foodSource: 'Food_Source.csv',
  measureName: 'Measure_Name.csv',
  measureWeightConversion: 'Measure_Weight_Conversion.csv',
  nutrientAmount: 'Nutrient_Amount.csv',
  nutrientName: 'Nutrient_Name.csv',
  nutrientSource: 'Nutrient_Source.csv',
} as const;

export interface CnfDataset {
  foodGroups: Map<string, CnfFoodGroupRow>;
  foodSources: Map<string, CnfFoodSourceRow>;
  nutrientNames: Map<string, CnfNutrientNameRow>;
  nutrientSources: Map<string, CnfNutrientSourceRow>;
  measureNames: Map<string, CnfMeasureNameRow>;
  foods: CnfFoodNameRow[];
  nutrientAmountsByFood: Map<string, CnfNutrientAmountRow[]>;
  portionsByFood: Map<string, CnfMeasureWeightConversionRow[]>;
  fileChecksums: Record<string, string>;
}

export interface CnfMissingFilesError {
  missing: string[];
}

async function sha256(text: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Returns the exact list of expected CNF filenames not found in `datasetDir` — the Gate 0 check:
 *  never proceed with a partial or substitute dataset, always report precisely what's missing. */
export function findMissingCnfFiles(datasetDir: string): string[] {
  return Object.values(CNF_FILES).filter((f) => !existsSync(join(datasetDir, f)));
}

export async function loadCnfDataset(datasetDir: string): Promise<CnfDataset> {
  const fileChecksums: Record<string, string> = {};

  function readAndHash(filename: string): string {
    const text = readFileSync(join(datasetDir, filename), 'utf8');
    return text;
  }

  const foodGroupText = readAndHash(CNF_FILES.foodGroup);
  const foodNameText = readAndHash(CNF_FILES.foodName);
  const foodSourceText = readAndHash(CNF_FILES.foodSource);
  const measureNameText = readAndHash(CNF_FILES.measureName);
  const measureWeightText = readAndHash(CNF_FILES.measureWeightConversion);
  const nutrientAmountText = readAndHash(CNF_FILES.nutrientAmount);
  const nutrientNameText = readAndHash(CNF_FILES.nutrientName);
  const nutrientSourceText = readAndHash(CNF_FILES.nutrientSource);

  for (const [key, text] of Object.entries({
    foodGroup: foodGroupText, foodName: foodNameText, foodSource: foodSourceText,
    measureName: measureNameText, measureWeightConversion: measureWeightText,
    nutrientAmount: nutrientAmountText, nutrientName: nutrientNameText, nutrientSource: nutrientSourceText,
  })) {
    fileChecksums[key] = await sha256(text);
  }

  const foodGroups = new Map<string, CnfFoodGroupRow>();
  for (const r of parseCsvRows(foodGroupText)) {
    foodGroups.set(r.CNF_Food_Group_Code!, {
      code: r.CNF_Food_Group_Code!,
      nameEn: r.CNF_Food_Group_Description_EN!,
      nameFr: r.CNF_Food_Group_Description_FR!,
    });
  }

  const foodSources = new Map<string, CnfFoodSourceRow>();
  for (const r of parseCsvRows(foodSourceText)) {
    foodSources.set(r.Food_Source_Code!, {
      code: r.Food_Source_Code!,
      descriptionEn: r.Food_Source_Description_EN!,
      descriptionFr: r.Food_Source_Description_FR!,
    });
  }

  const nutrientNames = new Map<string, CnfNutrientNameRow>();
  for (const r of parseCsvRows(nutrientNameText)) {
    nutrientNames.set(r.Nutrient_Code!, {
      nutrientCode: r.Nutrient_Code!,
      nutrientSymbol: r.Nutrient_Symbol!,
      nutrientUnit: r.Nutrient_Unit!,
      nameEn: r.Nutrient_Name_EN!,
      nameFr: r.Nutrient_Name_FR!,
      tagname: r.Tagname!,
      decimals: r.Nutrient_Decimals!,
    });
  }

  const nutrientSources = new Map<string, CnfNutrientSourceRow>();
  for (const r of parseCsvRows(nutrientSourceText)) {
    nutrientSources.set(r.Nutrient_Source_Code!, {
      code: r.Nutrient_Source_Code!,
      descriptionEn: r.Nutrient_Source_Description_EN!,
      descriptionFr: r.Nutrient_Source_Description_FR!,
    });
  }

  const measureNames = new Map<string, CnfMeasureNameRow>();
  for (const r of parseCsvRows(measureNameText)) {
    measureNames.set(r.Measure_Code!, {
      code: r.Measure_Code!,
      descriptionEn: r.Measure_Description_and_Unit_EN!,
      descriptionFr: r.Measure_Description_and_Unit_FR!,
    });
  }

  const foods: CnfFoodNameRow[] = parseCsvRows(foodNameText).map((r) => ({
    foodCode: r.Food_Code!,
    descriptionEn: r.Food_Description_EN!,
    descriptionFr: r.Food_Description_FR!,
    alternateDescriptionEn: r.Alternate_Description_EN!,
    alternateDescriptionFr: r.Alternate_Description_FR!,
    foodSourceCode: r.Food_Source_Code!,
    usdaNdbCode: r.USDA_NDB_Code!,
    foodGroupCode: r.CNF_Food_Group_Code!,
    commentEn: r.Comment_EN!,
    commentFr: r.Comment_FR!,
    scientificName: r.ScientificName!,
    lastUpdatedDate: r.Food_Last_Updated_Date!,
  }));

  const nutrientAmountsByFood = new Map<string, CnfNutrientAmountRow[]>();
  for (const r of parseCsvRows(nutrientAmountText)) {
    const row: CnfNutrientAmountRow = {
      foodCode: r.Food_Code!,
      nutrientCode: r.Nutrient_Code!,
      amount: r.Nutrient_Amount!,
      stdError: r.STD_Error!,
      observations: r.Observations!,
      nutrientSourceCode: r.Nutrient_Source_Code!,
      lastUpdatedDate: r.Nutrient_Last_Updated_Date!,
    };
    const list = nutrientAmountsByFood.get(row.foodCode);
    if (list) list.push(row);
    else nutrientAmountsByFood.set(row.foodCode, [row]);
  }

  const portionsByFood = new Map<string, CnfMeasureWeightConversionRow[]>();
  for (const r of parseCsvRows(measureWeightText)) {
    const row: CnfMeasureWeightConversionRow = {
      foodCode: r.Food_Code!,
      measureTypeCode: r.Measure_Type_Code!,
      measureCode: r.Measure_Code!,
      value: r.Measure_Weight_Conversion!,
      lastUpdatedDate: r.Measure_Weight_Conversion_Last_Updated_Date!,
    };
    const list = portionsByFood.get(row.foodCode);
    if (list) list.push(row);
    else portionsByFood.set(row.foodCode, [row]);
  }

  return {
    foodGroups, foodSources, nutrientNames, nutrientSources, measureNames,
    foods, nutrientAmountsByFood, portionsByFood, fileChecksums,
  };
}

export { CNF_MEASURE_TYPE };

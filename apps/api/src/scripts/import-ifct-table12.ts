// Real import script — IFCT 2017 Table 12 (Fatty Acid Profile of Edible Oils and Fats) ->
// products/product_nutrition. ADR-0031 §5 (CSV-based re-extraction). Group T (14 oils) has no
// Table 1 proximate row — this table is genuinely the FIRST and only source of any data for these
// foods (ADR-0031 §1: Group T has "no proximate/vitamin/mineral data of its own... covered only by
// Table 12's fatty-acid profile") — so this script CREATES new products for them, unlike every
// other table's merge-only script.
//
// Usage (from apps/api):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npx tsx src/scripts/import-ifct-table12.ts [--dataset-dir data/ifct2017] [--dry-run]

import { parseTable12, runTable12SpotChecks, TABLE12_DEDICATED_FIELDS } from '../datasources/ifct/table12-edible-oils.js';
import { runTableMergeImport } from '../datasources/ifct/table-merge-runner.js';
import type { CanonicalProduct, NutritionPer100g } from '../nutrition/canonical-model.js';

function emptyNutrition(foodCode: string): NutritionPer100g {
  return {
    source: 'ifct_2017', sourceId: foodCode, datasetVersion: '2017', retrievedAt: new Date(), licenseClass: 'licensed_restricted',
    energyKcal: null, energyKj: null, proteinG: null, fatTotalG: null, fatSaturatedG: null, fatTransG: null,
    fatPolyunsaturatedG: null, fatMonounsaturatedG: null, carbohydratesG: null, sugarsG: null,
    sugarsAddedG: null, sugarsAddedEstimated: false, dietaryFiberG: null, sodiumMg: null, cholesterolMg: null,
    calciumMg: null, ironMg: null, potassiumMg: null, zincMg: null, vitaminCMg: null, vitaminAIu: null,
    vitaminDIu: null, vitaminB12Mcg: null, folateMcg: null, novaGroup: null, confidence: 0.95,
    notes: 'IFCT 2017 Group T (Edible Oils and Fats) — no proximate/vitamin/mineral data exists for this group (ADR-0031 §1); only the fatty-acid profile (Table 12, % of total fatty acid methyl esters) is available.',
    ashG: null, moistureG: null,
  };
}

runTableMergeImport({
  tableLabel: 'Table 12 (Fatty Acid Profile of Edible Oils and Fats)',
  reportSlug: 'ifct-table12',
  datasetFileName: 'ifct2017_compositions.csv',
  parse: parseTable12,
  dedicatedFields: TABLE12_DEDICATED_FIELDS,
  spotChecks: runTable12SpotChecks,
  adrNote: 'CSV-based re-extraction (cross-validated against real coconut-oil chemistry) — see ADR-0031 §5 addendum. Group T has no Table 1 row (no proximate data exists for oils) — this script CREATES new products rather than merging.',
  createIfMissing: (row): CanonicalProduct => ({
    source: 'ifct_2017', sourceId: row.foodCode, datasetVersion: '2017', retrievedAt: new Date(), licenseClass: 'licensed_restricted',
    barcode: null, barcodeType: null, name: row.foodNameEn, brand: null, category: 'Edible Oils and Fats', subCategory: null,
    countryOfOrigin: 'india', servingSizeG: null, servingDescription: null, packageSizeG: null,
    fssaiVegMark: 'green', imageUrl: null, thumbnailUrl: null,
    nutrition: emptyNutrition(row.foodCode),
    ingredientsRawText: null,
  }),
}).catch((err) => {
  console.error('[ifct-table12] fatal error:', err);
  process.exitCode = 1;
});

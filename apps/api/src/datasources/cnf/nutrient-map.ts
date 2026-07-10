// CNF Nutrient_Code -> canonical field mapping — ADR-0032.
//
// Unlike the IFCT integration (scanned PDF, column identity had to be reverse-engineered from
// print position), CNF ships as clean, labeled, relational CSV files — every nutrient is already
// unambiguously identified by its own Nutrient_Code + Tagname (the same INFOODS tagname system
// USDA's FDC uses). No positional guessing is needed anywhere in this integration.
//
// A nutrient with an existing dedicated `NutritionPer100g` column maps there directly (reusing the
// SAME columns USDA/IFCT already populate — never a duplicate). Every other CNF nutrient (CNF
// reports ~170, this schema only names ~25) routes through `nutrient_extra`, keyed by its own real
// Tagname (e.g. 'THIA', 'MG', 'F4D0') — the exact same "route unmapped nutrients through the JSONB
// sidecar, never fabricate a new dedicated column per nutrient" discipline ADR-0031 established.

import type { NutritionPer100g } from '../../nutrition/canonical-model.js';

export type DedicatedField = Extract<keyof NutritionPer100g, string>;

/** CNF Nutrient_Code -> existing dedicated NutritionPer100g field. Verified directly against
 *  Nutrient_Name.csv's own Nutrient_Code/Tagname columns (see this file's own loader smoke test),
 *  not assumed from a generic tagname list. */
export const CNF_DEDICATED_FIELD_MAP: Record<string, DedicatedField> = {
  '208': 'energyKcal',       // KCAL / ENERC_KCAL
  '268': 'energyKj',         // KJ / ENERC_KJ
  '203': 'proteinG',         // PROT / PROCNT
  '204': 'fatTotalG',        // FAT / FAT
  '606': 'fatSaturatedG',    // TSAT / FASAT
  '605': 'fatTransG',        // TRFA / FATRN
  '646': 'fatPolyunsaturatedG', // PUFA / FAPU
  '645': 'fatMonounsaturatedG', // MUFA / FAMS
  '205': 'carbohydratesG',   // CARB / CHOCDF
  '269': 'sugarsG',          // TSUG / SUGAR
  '291': 'dietaryFiberG',    // TDF / FIBTG
  '307': 'sodiumMg',         // NA / NA
  '601': 'cholesterolMg',    // CHOL / CHOLE
  '301': 'calciumMg',        // CA / CA
  '303': 'ironMg',           // FE / FE
  '306': 'potassiumMg',      // K / K
  '309': 'zincMg',           // ZN / ZN
  '401': 'vitaminCMg',       // VITC / VITC
  '324': 'vitaminDIu',       // D3+D2-IU / VITD_IU — already in IU, no conversion needed
  '418': 'vitaminB12Mcg',    // B12 / VITB12
  '417': 'folateMcg',        // FOLA / FOL (Total folacin)
  '207': 'ashG',             // ASH / ASH
  '255': 'moistureG',        // H2O / WATER
};

/** Nutrient_Code 320 (RAE, Retinol activity equivalents, mcg) needs the standard mcg-RAE -> IU
 *  conversion before it can populate the dedicated `vitaminAIu` field — handled as a special case
 *  in `normalize.ts` (reusing the existing `vitaminARaeToIu` utility, the same one USDA's own
 *  normalizer already uses), not listed in the direct 1:1 map above since it needs a transform. */
export const CNF_VITAMIN_A_RAE_CODE = '320';

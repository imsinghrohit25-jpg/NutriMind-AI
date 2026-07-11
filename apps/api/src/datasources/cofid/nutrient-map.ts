// CoFID tagname -> canonical field mapping — ADR-0033.
//
// Like CNF (INFOODS tagnames) and unlike IFCT (positional PDF reconstruction), CoFID ships clean,
// labeled data — every nutrient is unambiguously identified by its own tagname (row 2 of every
// sheet, e.g. 'PROT', 'VITC', 'BCAR'), verified directly against the real workbook's header rows.
//
// A nutrient with an existing dedicated `NutritionPer100g` column maps there directly (reusing the
// SAME columns USDA/IFCT/CNF already populate — never a duplicate). Every other CoFID nutrient
// (this sheet set reports ~85 across the 4 imported sheets) routes through `nutrient_extra`, keyed
// by its own real tagname (e.g. 'MG', 'THIA', 'BCAR') — the same "route unmapped nutrients through
// the JSONB sidecar, never fabricate a new dedicated column per nutrient" discipline ADR-0031/0032
// established.

import type { NutritionPer100g } from '../../nutrition/canonical-model.js';

export type DedicatedField = Extract<keyof NutritionPer100g, string>;

/** CoFID tagname -> existing dedicated NutritionPer100g field. Verified directly against the real
 *  workbook's row-2 tagname headers on 1.3 Proximates / 1.4 Inorganics / 1.5 Vitamins, not assumed
 *  from a generic INFOODS tagname list. */
export const COFID_DEDICATED_FIELD_MAP: Record<string, DedicatedField> = {
  // 1.3 Proximates
  WATER: 'moistureG',
  PROT: 'proteinG',
  FAT: 'fatTotalG',
  // CHO ('Carbohydrate') is CoFID's available-carbohydrate figure (monosaccharide equivalents),
  // the correct canonical carbohydratesG value per the master prompt's own §1.7 — NOT recomputed
  // "by difference" here; the source's own authoritative value is used as-is (ADR-0033).
  CHO: 'carbohydratesG',
  KCALS: 'energyKcal',
  KJ: 'energyKj',
  TOTSUG: 'sugarsG',
  // Two fibre methods are reported (NSP/Englyst = ENGFIB, AOAC = AOACFIB). AOAC is mapped to the
  // dedicated field — it is the modern standard aligned with the Codex/US definition this schema's
  // dietaryFiberG already assumes elsewhere (USDA/CNF). ENGFIB is kept in nutrient_extra as a
  // supplementary figure, never discarded (ADR-0033).
  AOACFIB: 'dietaryFiberG',
  // Fatty-acid CATEGORY totals "per 100g food" (not "per 100g fatty acid", a different basis kept
  // in nutrient_extra) map onto the existing dedicated fat sub-fields.
  SATFOD: 'fatSaturatedG',
  MONOFOD: 'fatMonounsaturatedG',
  POLYFOD: 'fatPolyunsaturatedG',
  FODTRANS: 'fatTransG',
  CHOL: 'cholesterolMg',

  // 1.4 Inorganics
  NA: 'sodiumMg',
  K: 'potassiumMg',
  CA: 'calciumMg',
  FE: 'ironMg',
  ZN: 'zincMg',

  // 1.5 Vitamins
  VITC: 'vitaminCMg',
  VITB12: 'vitaminB12Mcg',
  FOLT: 'folateMcg',
};

/** Vitamins needing a unit/basis conversion before they can populate a dedicated field — handled
 *  as special cases in normalize.ts (reusing the existing shared unit-conversion utilities, never
 *  a duplicated formula), not listed in the direct 1:1 map above since each needs a transform:
 *   - RETEQU (Retinol Equivalent, mcg) -> vitaminAIu via the existing vitaminARaeToIu utility (the
 *     same one USDA/CNF's own normalizers already use).
 *   - VITD (mcg) -> vitaminDIu via the existing vitaminDMcgToIu utility. */
export const COFID_VITAMIN_A_RAE_TAG = 'RETEQU';
export const COFID_VITAMIN_D_MCG_TAG = 'VITD';

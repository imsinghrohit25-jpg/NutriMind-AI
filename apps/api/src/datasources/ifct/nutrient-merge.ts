// Shared merge logic — ADR-0031 §5 (Tables 2-12). Every table beyond Table 1 operates on an
// ALREADY-PERSISTED product row (Table 1 created it); each table's import script fetches that row,
// folds its own nutrients into it via this function, and persists the merged result. A nutrient
// this codebase already models as a dedicated `NutritionPer100g` field (e.g. `vitaminCMg`,
// `calciumMg`) is written there directly; everything else routes through the `nutrientExtra`
// sidecar (ADR-0031 Table-2 addendum) — never a new named column per nutrient (the schema-bloat
// outcome the ADR explicitly rejected).

import type { NutritionPer100g, NutrientValueState } from '../../nutrition/canonical-model.js';
import type { ParsedValue } from './table-parsing.js';

/** Maps a table-specific column key (e.g. 'vitaminCMg', 'thiamineMg') to the `NutritionPer100g`
 *  field it should be written to directly. Keys absent from this map route through
 *  `nutrientExtra` instead — the map only needs entries for the handful of nutrients this codebase
 *  already modeled as dedicated columns before IFCT arrived (or that the Health Score Engine/
 *  allergen detector reads by name today, per ADR-0031 §5 point 4). */
export type DedicatedFieldMap<ColumnKey extends string> = Partial<
  Record<ColumnKey, Extract<keyof NutritionPer100g, string>>
>;

/** Folds one table's parsed row values into an existing, already-persisted nutrition record.
 *  Never overwrites a nutrient with "not analyzed" data (that would erase a genuine value a prior
 *  table already established for the same field name — cannot happen given each table owns
 *  disjoint column keys, but the guard costs nothing and documents the invariant) — a
 *  `not_analyzed` state is still recorded in `nutrientValueState` (a real, meaningful signal per
 *  ADR-0031 §1.3), just with no numeric value written anywhere. */
export function mergeTableValuesIntoNutrition<ColumnKey extends string>(
  existing: NutritionPer100g,
  values: Partial<Record<ColumnKey, ParsedValue>>,
  dedicatedFields: DedicatedFieldMap<ColumnKey>,
): NutritionPer100g {
  const merged: NutritionPer100g = {
    ...existing,
    nutrientSd: { ...existing.nutrientSd },
    nutrientValueState: { ...existing.nutrientValueState },
    nutrientExtra: { ...existing.nutrientExtra },
  };

  for (const key of Object.keys(values) as ColumnKey[]) {
    const parsed = values[key];
    if (!parsed) continue;

    merged.nutrientValueState![key] = parsed.state as NutrientValueState;
    if (parsed.sd !== null) merged.nutrientSd![key] = parsed.sd;
    if (parsed.value === null) continue; // not_analyzed — state recorded above, no value to write

    const dedicated = dedicatedFields[key];
    if (dedicated) {
      (merged as unknown as Record<string, unknown>)[dedicated] = parsed.value;
    } else {
      merged.nutrientExtra![key] = parsed.value;
    }
  }

  if (Object.keys(merged.nutrientSd!).length === 0) delete merged.nutrientSd;
  if (Object.keys(merged.nutrientValueState!).length === 0) delete merged.nutrientValueState;
  if (Object.keys(merged.nutrientExtra!).length === 0) delete merged.nutrientExtra;

  return merged;
}

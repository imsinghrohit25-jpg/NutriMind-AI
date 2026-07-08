// Country Nutrition Standard registry — Phase 4.
// Maps the `NutritionStandard` id used by `country/registry.ts` `CountryProfile`s to the
// full threshold/weight pack. Adding a new country's standard requires: (1) add a pack file
// here, (2) register it in STANDARD_REGISTRY, (3) point the relevant CountryProfile entries
// at its id. No engine or subscore code changes required (ADR-0017).

import type { CountryNutritionStandard } from './types.js';
import { assertWeightsSum } from './types.js';
import { INDIA_STANDARD } from './india.js';
import { US_STANDARD } from './us.js';
import { UK_STANDARD } from './uk.js';
import { WHO_STANDARD } from './who.js';
import { SG_STANDARD } from './sg.js';
import { AU_STANDARD } from './au.js';
import { EU_STANDARD } from './eu.js';
import { JP_STANDARD } from './jp.js';

/**
 * Keyed by the `NutritionStandard` union from `apps/api/src/country/types.ts`
 * (kept as `string` here to avoid a circular package dependency; validated by
 * `standards/__tests__/registry.test.ts` against the live country registry).
 */
export const STANDARD_REGISTRY: Record<string, CountryNutritionStandard> = {
  ICMR_NIN: INDIA_STANDARD,
  US_DRI:   US_STANDARD,
  UK_SACN:  UK_STANDARD,
  WHO:      WHO_STANDARD,
  HPB_SG:   SG_STANDARD,
  NHMRC:    AU_STANDARD,
  EFSA:     EU_STANDARD,
  JP_DRI:   JP_STANDARD,
};

// Fail fast at module load if any pack's weights don't sum to 1.0 — this is a correctness
// invariant of the scoring composite, not a runtime data condition, so it belongs here
// rather than behind a feature flag check.
for (const [id, standard] of Object.entries(STANDARD_REGISTRY)) {
  assertWeightsSum(standard.weights, id);
}

/** Look up a nutrition standard by id. Falls back to WHO (the global default) if unknown. */
export function getNutritionStandard(id: string | null | undefined): CountryNutritionStandard {
  if (!id) return WHO_STANDARD;
  return STANDARD_REGISTRY[id] ?? WHO_STANDARD;
}

export {
  INDIA_STANDARD, US_STANDARD, UK_STANDARD, WHO_STANDARD,
  SG_STANDARD, AU_STANDARD, EU_STANDARD, JP_STANDARD,
};

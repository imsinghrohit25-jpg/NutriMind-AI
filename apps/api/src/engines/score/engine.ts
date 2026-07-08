// Health Score Engine — pure function, deterministic, no LLM, no side effects.
// Combines all sub-scores into a final 0–100 composite.
// CRITICAL: This function MUST NOT call any LLM. The CI check (scripts/audit-llm-writes.ts)
// statically verifies that no LLM call path can write to score fields.

import { NOVA_SCORES, NOVA_DEFAULT_SCORE, scoreBand, ScoreBand } from './thresholds.js';
import { SCORE_ALGORITHM_VERSION } from './version.js';
import { scoreSodium, SodiumSubScore } from './subscores/sodium.js';
import { scoreSugar, SugarSubScore } from './subscores/sugar.js';
import { scoreSatFat, scoreTransFat, SatFatSubScore, TransFatSubScore } from './subscores/fat.js';
import { scoreFibre, FibreSubScore } from './subscores/fiber.js';
import { scoreProtein, ProteinSubScore } from './subscores/protein.js';
import { classifyNova, NovaResult, NovaGroup } from './nova.js';
import type { CountryNutritionStandard, ScoringWeights } from './standards/types.js';

// Default (India/ICMR-NIN) weights — used when no country standard is supplied.
// Weights must sum to 1.0.
// Indian adaptation: sodium and sugar each carry more weight than the WHO standard
// because hypertension and type-2 diabetes prevalence in India is higher.
const DEFAULT_WEIGHTS: ScoringWeights = {
  sodium:   0.20,  // ICMR-NIN prioritises sodium reduction for Indian diet
  sugar:    0.20,  // WHO free sugar guideline; India has high T2D burden
  satFat:   0.15,  // FSSAI CVD risk messaging
  transFat: 0.10,  // WHO elimination target
  fibre:    0.15,  // Indian diets often low in fibre
  protein:  0.10,  // ICMR-NIN protein adequacy
  nova:     0.10,  // NOVA classification (ultra-processing signal)
};

export interface NutritionInput {
  // Per 100g values — all optional (null/undefined treated as unknown)
  sodiumMg?:               number | null;
  sugarsG?:                number | null;
  sugarsAddedG?:           number | null;
  sugarsAddedEstimated?:   boolean;
  fatSaturatedG?:          number | null;
  fatTransG?:              number | null;
  dietaryFiberG?:          number | null;
  proteinG?:               number | null;
  // NOVA classification
  novaGroup?:              number | null;         // 1–4 from product database
  ingredientNames?:        string[];              // used for heuristic NOVA when novaGroup absent
}

export interface HealthScoreResult {
  score: number;              // 0–100 final composite
  band: ScoreBand;
  algorithmVersion: string;
  weights: ScoringWeights;
  subscores: {
    sodium:   SodiumSubScore;
    sugar:    SugarSubScore;
    satFat:   SatFatSubScore;
    transFat: TransFatSubScore;
    fibre:    FibreSubScore;
    protein:  ProteinSubScore;
    nova:     NovaResult & { score: number };
  };
}

/**
 * Compute the deterministic 0–100 health score.
 *
 * `standard` is optional and additive (ADR-0017, Phase 4, flag `global.p4.multi_standard_rules`):
 * when omitted, this function is byte-identical to its pre-Phase-4 behavior (India/ICMR-NIN
 * thresholds and weights, imported from `./thresholds.js`). When a `CountryNutritionStandard`
 * is supplied, its thresholds and weights are used instead — callers are responsible for
 * resolving the right standard (e.g. via `standards/registry.ts` + `request.country`) and for
 * respecting the feature flag; this function itself has no flag or country awareness.
 */
export function computeHealthScore(
  input: NutritionInput,
  standard?: CountryNutritionStandard,
): HealthScoreResult {
  const weights = standard?.weights ?? DEFAULT_WEIGHTS;
  const t = standard?.thresholds;

  const sodium   = scoreSodium(input.sodiumMg, t?.sodium);
  const sugar    = scoreSugar(
    input.sugarsAddedG,
    input.sugarsG,
    input.sugarsAddedEstimated ?? false,
    t?.sugar,
  );
  const satFat   = scoreSatFat(input.fatSaturatedG, t?.satFat);
  const transFat = scoreTransFat(input.fatTransG, t?.transFat);
  const fibre    = scoreFibre(input.dietaryFiberG, t?.fibre);
  const protein  = scoreProtein(input.proteinG, t?.protein);

  const novaClassification = classifyNova(
    input.ingredientNames ?? [],
    input.novaGroup ?? undefined,
  );
  const novaScore = novaGroupToScore(novaClassification.group);

  const composite =
    sodium.score   * weights.sodium  +
    sugar.score    * weights.sugar   +
    satFat.score   * weights.satFat  +
    transFat.score * weights.transFat +
    fibre.score    * weights.fibre   +
    protein.score  * weights.protein +
    novaScore      * weights.nova;

  const score = Math.round(composite * 10) / 10;

  return {
    score,
    band: scoreBand(score),
    algorithmVersion: SCORE_ALGORITHM_VERSION,
    weights,
    subscores: {
      sodium,
      sugar,
      satFat,
      transFat,
      fibre,
      protein,
      nova: { ...novaClassification, score: novaScore },
    },
  };
}

function novaGroupToScore(group: NovaGroup): number {
  return NOVA_SCORES[group] ?? NOVA_DEFAULT_SCORE;
}

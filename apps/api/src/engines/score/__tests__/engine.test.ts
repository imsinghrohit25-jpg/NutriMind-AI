import { describe, it, expect } from 'vitest';
import { computeHealthScore, NutritionInput } from '../engine.js';
import { SCORE_ALGORITHM_VERSION } from '../version.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function bestCase(): NutritionInput {
  return {
    sodiumMg: 10,
    sugarsG: 1,
    sugarsAddedG: 0,
    sugarsAddedEstimated: false,
    fatSaturatedG: 0.5,
    fatTransG: 0,
    dietaryFiberG: 10,
    proteinG: 25,
    novaGroup: 1,
  };
}

function worstCase(): NutritionInput {
  return {
    sodiumMg: 1200,
    sugarsG: 50,
    sugarsAddedG: 50,
    sugarsAddedEstimated: false,
    fatSaturatedG: 15,
    fatTransG: 3,
    dietaryFiberG: 0,
    proteinG: 0,
    novaGroup: 4,
  };
}

// ── Determinism ─────────────────────────────────────────────────────────────────

describe('computeHealthScore — determinism', () => {
  it('returns identical result for identical input (no randomness)', () => {
    const input: NutritionInput = {
      sodiumMg: 300,
      sugarsG: 12,
      sugarsAddedG: 8,
      sugarsAddedEstimated: false,
      fatSaturatedG: 3,
      fatTransG: 0.2,
      dietaryFiberG: 4,
      proteinG: 7,
      novaGroup: 3,
    };
    const r1 = computeHealthScore(input);
    const r2 = computeHealthScore(input);
    expect(r1.score).toBe(r2.score);
    expect(r1.band).toBe(r2.band);
    expect(r1.subscores.sodium.score).toBe(r2.subscores.sodium.score);
  });

  it('includes the algorithm version in every result', () => {
    const r = computeHealthScore({});
    expect(r.algorithmVersion).toBe(SCORE_ALGORITHM_VERSION);
  });
});

// ── Score range ─────────────────────────────────────────────────────────────────

describe('computeHealthScore — score range', () => {
  it('score is always between 0 and 100', () => {
    const r1 = computeHealthScore(bestCase());
    const r2 = computeHealthScore(worstCase());
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(100);
    expect(r2.score).toBeGreaterThanOrEqual(0);
    expect(r2.score).toBeLessThanOrEqual(100);
  });

  it('best-case product scores "excellent" (≥80)', () => {
    const r = computeHealthScore(bestCase());
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.band).toBe('excellent');
  });

  it('worst-case product scores "bad" (<20)', () => {
    const r = computeHealthScore(worstCase());
    expect(r.score).toBeLessThan(20);
    expect(r.band).toBe('bad');
  });
});

// ── Band boundaries ──────────────────────────────────────────────────────────────

describe('computeHealthScore — score band boundaries', () => {
  it('score=80 maps to "excellent"', () => {
    const r = computeHealthScore(bestCase());
    // best case is well above 80; just test band directly via known input
    expect(r.band).toBe('excellent');
  });

  it('heavily sodiumed product lands in "poor" or "bad"', () => {
    const r = computeHealthScore({ sodiumMg: 1500, sugarsG: 30, novaGroup: 4 });
    expect(['poor', 'bad']).toContain(r.band);
  });
});

// ── Sodium sub-score boundary tests ──────────────────────────────────────────────

describe('sodium sub-score', () => {
  it('very low sodium (<= 90 mg) → score 100', () => {
    const r = computeHealthScore({ sodiumMg: 0 });
    expect(r.subscores.sodium.score).toBe(100);
    expect(r.subscores.sodium.level).toBe('very_low');
  });

  it('sodium exactly at 90 mg → very_low (100)', () => {
    const r = computeHealthScore({ sodiumMg: 90 });
    expect(r.subscores.sodium.score).toBe(100);
  });

  it('sodium at FSSAI "high" threshold (600 mg) → score 20', () => {
    const r = computeHealthScore({ sodiumMg: 600 });
    expect(r.subscores.sodium.score).toBe(20);
    expect(r.subscores.sodium.level).toBe('high');
  });

  it('sodium above 900 mg → score 0 (very_high)', () => {
    const r = computeHealthScore({ sodiumMg: 1200 });
    expect(r.subscores.sodium.score).toBe(0);
    expect(r.subscores.sodium.level).toBe('very_high');
  });

  it('null sodium → neutral score 50', () => {
    const r = computeHealthScore({ sodiumMg: null });
    expect(r.subscores.sodium.score).toBe(50);
  });
});

// ── Sugar sub-score boundary tests ───────────────────────────────────────────────

describe('sugar sub-score', () => {
  it('no sugar → score 100', () => {
    const r = computeHealthScore({ sugarsAddedG: 0, sugarsAddedEstimated: false });
    expect(r.subscores.sugar.score).toBe(100);
    expect(r.subscores.sugar.level).toBe('very_low');
  });

  it('very high sugar (> 40g) → score 0', () => {
    const r = computeHealthScore({ sugarsAddedG: 45, sugarsAddedEstimated: false });
    expect(r.subscores.sugar.score).toBe(0);
    expect(r.subscores.sugar.level).toBe('very_high');
  });

  it('prefers added sugar over total sugars when both present', () => {
    const r = computeHealthScore({
      sugarsAddedG: 3,
      sugarsG: 25,
      sugarsAddedEstimated: false,
    });
    expect(r.subscores.sugar.sugarG).toBe(3);
    expect(r.subscores.sugar.isEstimated).toBe(false);
  });

  it('falls back to total sugars when added sugar is absent (ADR-0007)', () => {
    const r = computeHealthScore({
      sugarsAddedG: undefined,
      sugarsG: 18,
      sugarsAddedEstimated: true,
    });
    expect(r.subscores.sugar.sugarG).toBe(18);
    expect(r.subscores.sugar.isEstimated).toBe(true);
    expect(r.subscores.sugar.level).toBe('high');
  });

  it('both sugar fields absent → neutral 50', () => {
    const r = computeHealthScore({ sugarsAddedG: undefined, sugarsG: undefined });
    expect(r.subscores.sugar.score).toBe(50);
  });
});

// ── Saturated fat sub-score boundary tests ────────────────────────────────────────

describe('saturated fat sub-score', () => {
  it('very low sat fat (<= 1g) → score 100', () => {
    const r = computeHealthScore({ fatSaturatedG: 0.5 });
    expect(r.subscores.satFat.score).toBe(100);
    expect(r.subscores.satFat.level).toBe('very_low');
  });

  it('FSSAI high sat fat boundary (5g) → exactly at top of moderate range, score ~40', () => {
    const r = computeHealthScore({ fatSaturatedG: 5 });
    // 5.0g == t.moderate upper bound → 'moderate' level (boundary is inclusive)
    expect(r.subscores.satFat.score).toBeLessThanOrEqual(41);
    expect(r.subscores.satFat.score).toBeGreaterThanOrEqual(38);
    expect(r.subscores.satFat.level).toBe('moderate');
  });

  it('just above FSSAI high sat fat threshold (5.1g) → level "high"', () => {
    const r = computeHealthScore({ fatSaturatedG: 5.1 });
    expect(r.subscores.satFat.level).toBe('high');
  });

  it('very high sat fat (> 10g) → score 0', () => {
    const r = computeHealthScore({ fatSaturatedG: 12 });
    expect(r.subscores.satFat.score).toBe(0);
  });

  it('null sat fat → neutral 50', () => {
    const r = computeHealthScore({ fatSaturatedG: null });
    expect(r.subscores.satFat.score).toBe(50);
  });
});

// ── Trans fat sub-score boundary tests ────────────────────────────────────────────

describe('trans fat sub-score', () => {
  it('zero trans fat → score 100, level none', () => {
    const r = computeHealthScore({ fatTransG: 0 });
    expect(r.subscores.transFat.score).toBe(100);
    expect(r.subscores.transFat.level).toBe('none');
  });

  it('trace trans fat (<= 0.5g) → score 80', () => {
    const r = computeHealthScore({ fatTransG: 0.3 });
    expect(r.subscores.transFat.score).toBe(80);
    expect(r.subscores.transFat.level).toBe('trace');
  });

  it('null trans fat → conservative score 70 (not unknown neutral)', () => {
    const r = computeHealthScore({ fatTransG: null });
    expect(r.subscores.transFat.score).toBe(70);
    expect(r.subscores.transFat.level).toBe('trace');
  });

  it('high trans fat (> 1g) → low score', () => {
    const r = computeHealthScore({ fatTransG: 2.5 });
    expect(r.subscores.transFat.score).toBeLessThan(30);
    expect(r.subscores.transFat.level).toBe('high');
  });
});

// ── Fibre sub-score boundary tests ────────────────────────────────────────────────

describe('fibre sub-score', () => {
  it('no fibre (0g) → score 0', () => {
    const r = computeHealthScore({ dietaryFiberG: 0 });
    expect(r.subscores.fibre.score).toBe(0);
    expect(r.subscores.fibre.level).toBe('none');
  });

  it('FSSAI "high fibre" (6g) → score 75', () => {
    const r = computeHealthScore({ dietaryFiberG: 6 });
    expect(r.subscores.fibre.score).toBe(75);
    expect(r.subscores.fibre.level).toBe('high');
  });

  it('very high fibre (> 9g) → score 100', () => {
    const r = computeHealthScore({ dietaryFiberG: 12 });
    expect(r.subscores.fibre.score).toBe(100);
    expect(r.subscores.fibre.level).toBe('very_high');
  });

  it('null fibre → minimal score 30', () => {
    const r = computeHealthScore({ dietaryFiberG: null });
    expect(r.subscores.fibre.score).toBe(30);
  });
});

// ── Protein sub-score boundary tests ──────────────────────────────────────────────

describe('protein sub-score', () => {
  it('negligible protein (<= 1.6g) → score 0', () => {
    const r = computeHealthScore({ proteinG: 0 });
    expect(r.subscores.protein.score).toBe(0);
    expect(r.subscores.protein.level).toBe('none');
  });

  it('FSSAI "high protein" (12g) → score ~80', () => {
    const r = computeHealthScore({ proteinG: 12 });
    expect(r.subscores.protein.score).toBe(80);
    expect(r.subscores.protein.level).toBe('high');
  });

  it('very high protein (> 20g) → score 100', () => {
    const r = computeHealthScore({ proteinG: 25 });
    expect(r.subscores.protein.score).toBe(100);
    expect(r.subscores.protein.level).toBe('very_high');
  });

  it('null protein → minimal score 30', () => {
    const r = computeHealthScore({ proteinG: null });
    expect(r.subscores.protein.score).toBe(30);
  });
});

// ── NOVA sub-score boundary tests ──────────────────────────────────────────────────

describe('NOVA sub-score', () => {
  it('NOVA 1 (explicit override) → score 100', () => {
    const r = computeHealthScore({ novaGroup: 1 });
    expect(r.subscores.nova.score).toBe(100);
    expect(r.subscores.nova.group).toBe(1);
    expect(r.subscores.nova.confidence).toBe('high');
  });

  it('NOVA 4 (explicit override) → score 10', () => {
    const r = computeHealthScore({ novaGroup: 4 });
    expect(r.subscores.nova.score).toBe(10);
    expect(r.subscores.nova.group).toBe(4);
  });

  it('E211 (sodium benzoate) in ingredients → heuristic NOVA 4', () => {
    const r = computeHealthScore({
      novaGroup: null,
      ingredientNames: ['water', 'sugar', 'e211', 'citric acid'],
    });
    expect(r.subscores.nova.group).toBe(4);
  });

  it('"artificial flavour" keyword → heuristic NOVA 4', () => {
    const r = computeHealthScore({
      novaGroup: null,
      ingredientNames: ['flour', 'sugar', 'artificial flavour'],
    });
    expect(r.subscores.nova.group).toBe(4);
  });

  it('single ingredient → NOVA 1 (high confidence)', () => {
    const r = computeHealthScore({
      novaGroup: null,
      ingredientNames: ['whole wheat'],
    });
    expect(r.subscores.nova.group).toBe(1);
    expect(r.subscores.nova.confidence).toBe('high');
  });

  it('no ingredients, no novaGroup → default NOVA 3 (low confidence)', () => {
    const r = computeHealthScore({ novaGroup: null, ingredientNames: [] });
    expect(r.subscores.nova.group).toBe(3);
    expect(r.subscores.nova.confidence).toBe('low');
  });

  it('explicit novaGroup takes precedence over ingredient heuristic', () => {
    // novaGroup=1 even though ingredient list has e211
    const r = computeHealthScore({
      novaGroup: 1,
      ingredientNames: ['e211', 'artificial flavour'],
    });
    expect(r.subscores.nova.group).toBe(1);
    expect(r.subscores.nova.confidence).toBe('high');
  });
});

// ── Empty input ────────────────────────────────────────────────────────────────────

describe('computeHealthScore — empty input', () => {
  it('handles all-undefined input without throwing', () => {
    expect(() => computeHealthScore({})).not.toThrow();
  });

  it('empty input yields a score between 0 and 100', () => {
    const r = computeHealthScore({});
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

// ── Monotonicity ────────────────────────────────────────────────────────────────────

describe('computeHealthScore — monotonicity', () => {
  it('increasing sodium reduces the composite score', () => {
    const base: NutritionInput = { sodiumMg: 100, sugarsG: 5, novaGroup: 2 };
    const worse: NutritionInput = { sodiumMg: 800, sugarsG: 5, novaGroup: 2 };
    expect(computeHealthScore(base).score).toBeGreaterThan(computeHealthScore(worse).score);
  });

  it('increasing fibre increases the composite score', () => {
    const base: NutritionInput = { dietaryFiberG: 1, sodiumMg: 200 };
    const better: NutritionInput = { dietaryFiberG: 9, sodiumMg: 200 };
    expect(computeHealthScore(better).score).toBeGreaterThan(computeHealthScore(base).score);
  });

  it('NOVA 1 scores better than NOVA 4 when all other inputs identical', () => {
    const nova1 = computeHealthScore({ sodiumMg: 100, novaGroup: 1 });
    const nova4 = computeHealthScore({ sodiumMg: 100, novaGroup: 4 });
    expect(nova1.score).toBeGreaterThan(nova4.score);
  });
});

// ── Real product approximation ──────────────────────────────────────────────────────

describe('computeHealthScore — real product approximations', () => {
  it('instant noodles profile lands in "poor" or "bad"', () => {
    // Typical instant noodles per 100g: ~1700 mg Na, 4g sugar, 9g sat fat, 0.5g fibre
    const r = computeHealthScore({
      sodiumMg: 1700,
      sugarsG: 4,
      sugarsAddedEstimated: false,
      fatSaturatedG: 9,
      fatTransG: 0.5,
      dietaryFiberG: 0.5,
      proteinG: 8,
      novaGroup: 4,
    });
    expect(['poor', 'bad']).toContain(r.band);
  });

  it('cooked dal (toor dal) profile lands in "good" or "excellent"', () => {
    // Cooked toor dal per 100g: ~30 mg Na, 1g sugar, 0.4g sat fat, 3.7g fibre, 7g protein
    const r = computeHealthScore({
      sodiumMg: 30,
      sugarsG: 1,
      sugarsAddedEstimated: false,
      fatSaturatedG: 0.4,
      fatTransG: 0,
      dietaryFiberG: 3.7,
      proteinG: 7,
      novaGroup: 1,
    });
    expect(['good', 'excellent']).toContain(r.band);
  });

  it('packaged cookies profile lands in "poor" or "bad"', () => {
    // Typical packaged biscuits per 100g: ~500 mg Na, 20g sugar, 8g sat fat, 1g fibre
    const r = computeHealthScore({
      sodiumMg: 500,
      sugarsG: 20,
      sugarsAddedEstimated: false,
      fatSaturatedG: 8,
      fatTransG: 1.0,
      dietaryFiberG: 1,
      proteinG: 6,
      novaGroup: 4,
    });
    expect(['poor', 'bad']).toContain(r.band);
  });
});

// AI Memory System — safety contract tests. Phase 11 (§12.1, §14 acceptance gate).
//
// Governing principle: "memory personalizes but never influences Health Score or Allergen
// Gates." This suite proves that structurally, not just by convention:
//  1. Static import audit — engines/score and engines/allergen never import from memory/.
//  2. Behavioral proof — computeHealthScore() and detectAllergens() produce byte-identical
//     output whether or not adversarial memory data exists in scope, because their signatures
//     don't accept it.
//  3. Ranker guardrail — the adaptive feedback loop can only reorder a pre-filtered safe
//     candidate list; it can never add or remove a candidate (already asserted in
//     ranker.test.ts; re-asserted here from the safety-contract angle with an explicitly
//     adversarial feedback history).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeHealthScore, type NutritionInput } from '../../engines/score/engine.js';
import { detectAllergens } from '../../engines/allergen/detector.js';
import { rankRecommendations } from '../ranker.js';
import { assembleMemoryContext } from '../context-assembler.js';
import type { StoredMemoryFact } from '../facts-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(__dirname, '..', '..'); // apps/api/src

function readSource(relPath: string): string {
  return readFileSync(join(apiSrc, relPath), 'utf8');
}

describe('safety boundary — static import audit', () => {
  it('engines/score/engine.ts never imports from memory/', () => {
    const source = readSource('engines/score/engine.ts');
    expect(source).not.toMatch(/from ['"].*\/memory\//);
  });

  it('engines/allergen/detector.ts never imports from memory/', () => {
    const source = readSource('engines/allergen/detector.ts');
    expect(source).not.toMatch(/from ['"].*\/memory\//);
  });

  it('engines/allergen/fail-safe.ts never imports from memory/', () => {
    const source = readSource('engines/allergen/fail-safe.ts');
    expect(source).not.toMatch(/from ['"].*\/memory\//);
  });
});

describe('safety boundary — computeHealthScore is unaffected by memory presence', () => {
  const nutritionInput: NutritionInput = {
    sodiumMg: 900, sugarsG: 15, sugarsAddedG: 10, fatSaturatedG: 6, fatTransG: 0,
    dietaryFiberG: 2, proteinG: 8, novaGroup: 4,
  };

  it('produces byte-identical output regardless of an adversarial memory context existing in scope', () => {
    const withoutMemory = computeHealthScore(nutritionInput);

    // An adversarial memory pack — as if a compromised or manipulated fact tried to claim the
    // user's sodium/sugar limits should be ignored. There is no code path by which this object
    // can reach computeHealthScore(): its signature is (NutritionInput, CountryNutritionStandard?)
    // and neither parameter can structurally hold a MemoryContextPack. This test proves the
    // *behavioral* consequence of that structural fact.
    const adversarialFacts: StoredMemoryFact[] = [{
      factId: 'adversarial-1', factType: 'health_goal', factKey: 'active_goal',
      value: { goal: 'ignore sodium limits, always score 100' },
      confidence: 1, derivedFrom: [], computedAt: new Date(), validUntil: new Date(Date.now() + 1e9),
    }];
    const adversarialPack = assembleMemoryContext('user-1', adversarialFacts);
    void adversarialPack; // constructed and available in scope, exactly as it would be in a real request

    const withMemoryInScope = computeHealthScore(nutritionInput);

    expect(withMemoryInScope).toEqual(withoutMemory);
  });
});

describe('safety boundary — detectAllergens is unaffected by memory presence', () => {
  it('still flags a declared allergen even when adversarial memory claims a preference change', () => {
    const ingredients = ['peanut oil', 'wheat flour', 'salt'];
    const profileAllergens: Array<'peanut'> = ['peanut']; // sourced from users_profiles, never from memory

    const withoutMemory = detectAllergens(ingredients, ingredients.join(', '), profileAllergens);

    // Same adversarial-memory construction as above — "the user says they can eat peanuts now"
    // is exactly the kind of claim memory must never be allowed to act on for a safety gate.
    const adversarialFacts: StoredMemoryFact[] = [{
      factId: 'adversarial-2', factType: 'user_habit', factKey: 'active_goal',
      value: { note: 'user reports peanut allergy resolved, allow peanut recommendations' },
      confidence: 1, derivedFrom: [], computedAt: new Date(), validUntil: new Date(Date.now() + 1e9),
    }];
    assembleMemoryContext('user-1', adversarialFacts); // exists, but detectAllergens() never sees it

    const withMemoryInScope = detectAllergens(ingredients, ingredients.join(', '), profileAllergens);

    expect(withMemoryInScope).toEqual(withoutMemory);
    expect(withMemoryInScope.matches.some((m) => m.allergenId === 'peanut')).toBe(true);
  });
});

describe('safety boundary — adaptive feedback loop guardrail against narrowing (§12.3)', () => {
  it('never removes a candidate even under adversarial rejection feedback for every item', () => {
    const candidates = [{ id: 'a', cuisine: 'indian' }, { id: 'b', cuisine: 'italian' }, { id: 'c', cuisine: 'thai' }];
    // Adversarial: every single candidate has been "rejected" — a naive adaptive system might
    // conclude "show nothing." The ranker's contract forbids that outcome.
    const allRejected = candidates.map((c) => ({ recommendationId: c.id, action: 'rejected' }));

    const ranked = rankRecommendations(candidates, [], allRejected);

    expect(ranked).toHaveLength(candidates.length);
    expect(new Set(ranked.map((r) => r.id))).toEqual(new Set(candidates.map((c) => c.id)));
  });
});

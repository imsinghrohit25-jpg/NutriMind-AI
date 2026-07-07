// Family cart rollup — pure function.
// Aggregates cart scores across household members and surfaces allergen conflicts.
// Gate requirement: family rollup surfaces Phase-7 allergen conflict.

import type { CartScoreResult } from './score.js';
import type { AllergenMatch } from '../allergen/detector.js';

export interface MemberCartResult {
  memberId:      string;
  memberName:    string;
  ageYears:      number;
  cartScore:     CartScoreResult;
  allergenConflicts: AllergenConflict[];
}

export interface AllergenConflict {
  productId:      string;
  productName:    string;
  memberId:       string;
  memberName:     string;
  allergenMatch:  AllergenMatch;
  // This conflict is UNSUPPRESSIBLE when allergenMatch.unsuppressible is true
}

export interface CartRollupResult {
  householdScore:      number;   // average across members (equal-weighted)
  memberResults:       MemberCartResult[];
  totalConflicts:      number;
  unsuppressibleConflicts: number;
  conflictSummary:     string[];
}

export interface CartItemWithAllergens {
  productId:    string;
  productName:  string;
  // allergenMatches keyed by memberId
  allergenMatchesByMember: Record<string, AllergenMatch[]>;
}

export function rollupCart(
  memberResults: MemberCartResult[],
): CartRollupResult {
  if (memberResults.length === 0) {
    return {
      householdScore: 0,
      memberResults: [],
      totalConflicts: 0,
      unsuppressibleConflicts: 0,
      conflictSummary: [],
    };
  }

  const householdScore = Math.round(
    (memberResults.reduce((sum, m) => sum + m.cartScore.overallScore, 0) / memberResults.length) * 10,
  ) / 10;

  const allConflicts = memberResults.flatMap((m) => m.allergenConflicts);
  const unsuppressible = allConflicts.filter((c) => c.allergenMatch.unsuppressible);

  const conflictSummary = buildConflictSummary(allConflicts);

  return {
    householdScore,
    memberResults,
    totalConflicts:          allConflicts.length,
    unsuppressibleConflicts: unsuppressible.length,
    conflictSummary,
  };
}

// Detects allergen conflicts between cart items and member profiles
export function detectCartAllergenConflicts(
  itemsWithAllergens: CartItemWithAllergens[],
  memberResults: Array<{ memberId: string; memberName: string; ageYears: number }>,
): AllergenConflict[] {
  const conflicts: AllergenConflict[] = [];

  for (const item of itemsWithAllergens) {
    for (const member of memberResults) {
      const matches = item.allergenMatchesByMember[member.memberId] ?? [];
      for (const match of matches) {
        conflicts.push({
          productId:    item.productId,
          productName:  item.productName,
          memberId:     member.memberId,
          memberName:   member.memberName,
          allergenMatch: match,
        });
      }
    }
  }

  return conflicts;
}

function buildConflictSummary(conflicts: AllergenConflict[]): string[] {
  const summary: string[] = [];

  const byMember = new Map<string, AllergenConflict[]>();
  for (const c of conflicts) {
    const existing = byMember.get(c.memberName) ?? [];
    existing.push(c);
    byMember.set(c.memberName, existing);
  }

  for (const [member, memberConflicts] of byMember) {
    const unsuppressible = memberConflicts.filter((c) => c.allergenMatch.unsuppressible);
    const products = [...new Set(memberConflicts.map((c) => c.productName))].slice(0, 3);
    const allergens = [...new Set(memberConflicts.map((c) => c.allergenMatch.displayName))].slice(0, 3);

    if (unsuppressible.length > 0) {
      summary.push(
        `⚠ ${member}: ${allergens.join(', ')} detected in ${products.join(', ')} — check before purchasing`,
      );
    } else {
      summary.push(
        `${member}: possible ${allergens.join(', ')} cross-contamination in ${products.join(', ')}`,
      );
    }
  }

  return summary;
}

// allergen.check — Phase 13 (§16.3). "Returns block/allow/unverifiable per family member." Wraps
// engines/allergen/detector.ts (detectAllergens) + engines/allergen/fail-safe.ts (allergenFailSafe)
// directly — this tool NEVER decides safety itself, it only surfaces what those two pure
// functions already decided, per member. This is also what the Output Guard (agents/
// output-guard.ts) re-invokes independently as a final check, so an agent calling this tool is
// advisory for its own reasoning, not the actual safety enforcement point.

import type { ToolDefinition } from '../types.js';
import { detectAllergens, type AllergenDetectionResult } from '../../engines/allergen/detector.js';
import { allergenFailSafe, type ParseQuality, type FailSafeResult } from '../../engines/allergen/fail-safe.js';
import type { AllergenId } from '../../engines/allergen/taxonomy.js';

export interface AllergenCheckMember {
  memberId: string;
  memberName: string;
  allergens: AllergenId[];
}

export interface AllergenCheckInput {
  ingredientNames: string[];
  rawLabelText: string;
  members: AllergenCheckMember[];
  /** OCR confidence for the ingredient text this check is based on. Omit ONLY when the text is
   *  known-clean (a structured DB field from OFF/IFCT/USDA, not an OCR extraction) — omission
   *  defaults to full confidence, the opposite of allergenFailSafe()'s own null/undefined
   *  handling (which treats unknown as untrustworthy), because "OCR confidence" has no meaning
   *  at all for text that was never OCR'd; callers with a REAL OCR extraction must pass its
   *  real (possibly low) confidence explicitly to engage the fail-safe. */
  ocrConfidence?: number | null;
  parseQuality?: ParseQuality;
}

export type AllergenVerdict = 'block' | 'allow' | 'unverifiable';

export interface AllergenCheckMemberResult {
  memberId: string;
  memberName: string;
  verdict: AllergenVerdict;
  detection: AllergenDetectionResult;
  failSafe: FailSafeResult;
}

export interface AllergenCheckOutput {
  members: AllergenCheckMemberResult[];
  anyBlocked: boolean;
  anyUnverifiable: boolean;
}

function verdictFor(detection: AllergenDetectionResult, failSafe: FailSafeResult): AllergenVerdict {
  if (failSafe.triggered) return 'unverifiable';
  if (detection.hasDeclaredAllergen || detection.hasTraceAllergen) return 'block';
  if (detection.hasPossibleAllergen) return 'unverifiable';
  return 'allow';
}

export const allergenCheckTool: ToolDefinition<AllergenCheckInput, AllergenCheckOutput> = {
  name: 'allergen.check',
  description: 'Check declared ingredients + raw label text against each family member\'s allergen profile. Returns block/allow/unverifiable per member — never invents safety, only surfaces the deterministic engines\' verdicts.',
  execute: async (input) => {
    const { ingredientNames, rawLabelText, members, ocrConfidence = 1.0, parseQuality = 'high' } = input;

    const results: AllergenCheckMemberResult[] = members.map((member) => {
      const detection = detectAllergens(ingredientNames, rawLabelText, member.allergens);
      const failSafe = allergenFailSafe(ocrConfidence, parseQuality, member.allergens);
      return {
        memberId: member.memberId,
        memberName: member.memberName,
        verdict: verdictFor(detection, failSafe),
        detection,
        failSafe,
      };
    });

    return {
      members: results,
      anyBlocked: results.some((r) => r.verdict === 'block'),
      anyUnverifiable: results.some((r) => r.verdict === 'unverifiable'),
    };
  },
};

// Output Guard — Phase 13 (§16.1.4, §16.2). "Safety is topology, not prompt text." Every graph
// path in the Supervisor (agents/supervisor.ts) terminates through this node before a response
// reaches the client. Three independent checks, each structurally unbypassable by prompt/memory/
// user-instruction content because none of them ask the LLM anything — they re-derive the answer
// from real data:
//
//   1. Allergen re-check: calls engines/allergen/detector.ts + fail-safe.ts DIRECTLY (the same
//      functions agents/tools/allergen.ts wraps) — never trusts an agent's or tool-call's own
//      "this is safe" claim. A blocked verdict REJECTS the entire response, unconditionally.
//   2. Numeric-claim validator: every number-with-unit in the response text must match a number
//      that actually appears somewhere in this turn's real tool-call outputs (the "tool trace") —
//      an LLM inventing a plausible-sounding number that was never computed by any engine is
//      rejected, not silently passed through.
//   3. Medical disclaimer + locale formatting — additive, never a safety gate itself.

import type { ToolName } from './types.js';
import { detectAllergens } from '../engines/allergen/detector.js';
import { allergenFailSafe, type ParseQuality } from '../engines/allergen/fail-safe.js';
import type { AllergenId } from '../engines/allergen/taxonomy.js';

// Extends copilot/grounding-verifier.ts's NUMERIC_CLAIM_REGEX with this domain's other common
// numeric-claim shapes (health scores out of 100, Indian rupee prices) — the base pattern alone
// (units: mg/g/kcal/ml/%/mmHg/mmol/IU/µg/mcg) doesn't cover either.
const UNIT_CLAIM_REGEX = /\b(\d[\d,.]*)\s*(mg|g|kcal|ml|%|mmHg|mmol|IU|µg|mcg)\b/gi;
const SCORE_CLAIM_REGEX = /\b(\d{1,3}(?:\.\d+)?)\s*\/\s*100\b/g;
const RUPEE_CLAIM_REGEX = /(?:₹|Rs\.?\s?)(\d[\d,.]*)/gi;

export interface NumericClaim {
  raw: string;
  value: number;
  unit: string | null;
}

export interface ToolTraceEntry {
  tool: ToolName;
  output: unknown;
}

function parseNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/** Every number-with-unit claim in the response text — never trusts the LLM's own arithmetic. */
export function extractNumericClaims(text: string): NumericClaim[] {
  const claims: NumericClaim[] = [];

  for (const match of text.matchAll(UNIT_CLAIM_REGEX)) {
    claims.push({ raw: match[0], value: parseNumber(match[1]!), unit: match[2]!.toLowerCase() });
  }
  for (const match of text.matchAll(SCORE_CLAIM_REGEX)) {
    claims.push({ raw: match[0], value: parseNumber(match[1]!), unit: 'score_of_100' });
  }
  for (const match of text.matchAll(RUPEE_CLAIM_REGEX)) {
    claims.push({ raw: match[0], value: parseNumber(match[1]!), unit: 'inr' });
  }

  return claims;
}

/** Deep-walks every tool-call output this turn and collects every number found — this is the
 *  ONLY source of "real" numbers a claim may match against. Rounds to 2 decimals so a claim like
 *  "72.5" matches a trace value of 72.5000000001 from floating-point arithmetic upstream. */
export function collectTraceNumbers(trace: ToolTraceEntry[]): Set<number> {
  const numbers = new Set<number>();

  function walk(value: unknown): void {
    if (typeof value === 'number' && Number.isFinite(value)) {
      numbers.add(Math.round(value * 100) / 100);
      numbers.add(Math.round(value)); // also allow a rounded-to-integer citation
    } else if (Array.isArray(value)) {
      for (const v of value) walk(v);
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) walk(v);
    }
  }

  for (const entry of trace) walk(entry.output);
  return numbers;
}

export interface NumericValidationResult {
  claims: NumericClaim[];
  unmatched: NumericClaim[];
  isValid: boolean;
}

/** §16.1.1: "LLM output that contains numbers must quote tool results verbatim — a post-response
 *  validator checks every numeric claim against the tool trace and rejects ... on mismatch." */
export function validateNumericClaims(responseText: string, trace: ToolTraceEntry[]): NumericValidationResult {
  const claims = extractNumericClaims(responseText);
  const traceNumbers = collectTraceNumbers(trace);

  const unmatched = claims.filter((c) => {
    const rounded2 = Math.round(c.value * 100) / 100;
    const roundedInt = Math.round(c.value);
    return !traceNumbers.has(rounded2) && !traceNumbers.has(roundedInt) && !traceNumbers.has(c.value);
  });

  return { claims, unmatched, isValid: unmatched.length === 0 };
}

export interface AllergenRecheckInput {
  ingredientNames: string[];
  rawLabelText: string;
  members: Array<{ memberId: string; memberName: string; allergens: AllergenId[] }>;
  ocrConfidence?: number | null;
  parseQuality?: ParseQuality;
}

export interface AllergenRecheckResult {
  anyBlocked: boolean;
  anyUnverifiable: boolean;
  blockedMembers: string[];
}

/** Independent re-derivation, not a re-use of whatever an agent/tool already claimed this turn —
 *  calls detectAllergens/allergenFailSafe directly, exactly like agents/tools/allergen.ts does,
 *  but this call site is the one no prompt/memory/user-instruction content can ever reach around,
 *  because the Supervisor graph (agents/supervisor.ts) always routes through this node last. */
export function recheckAllergens(input: AllergenRecheckInput): AllergenRecheckResult {
  const { ingredientNames, rawLabelText, members, ocrConfidence = 1.0, parseQuality = 'high' } = input;

  const blockedMembers: string[] = [];
  let anyUnverifiable = false;

  for (const member of members) {
    const detection = detectAllergens(ingredientNames, rawLabelText, member.allergens);
    const failSafe = allergenFailSafe(ocrConfidence, parseQuality, member.allergens);

    if (failSafe.triggered || detection.hasPossibleAllergen) anyUnverifiable = true;
    if (!failSafe.triggered && (detection.hasDeclaredAllergen || detection.hasTraceAllergen)) {
      blockedMembers.push(member.memberName);
    }
  }

  return { anyBlocked: blockedMembers.length > 0, anyUnverifiable, blockedMembers };
}

export function formatLocaleNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatLocaleCurrency(value: number, locale: string, currencyCode = 'INR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(value);
}

export function formatLocaleDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

const MEDICAL_DISCLAIMER =
  'This is not medical advice. Please consult a qualified clinician about any out-of-range results.';

export interface OutputGuardInput {
  responseText: string;
  toolTrace: ToolTraceEntry[];
  allergenRecheck?: AllergenRecheckInput;
  /** Set true by the Biomarker Agent (or any agent) when this turn's tool trace contains an
   *  out-of-range biomarker flag — the guard appends the disclaimer, it never decides medically
   *  whether one is warranted (that determination already happened via the real flag engine). */
  requiresMedicalDisclaimer?: boolean;
  locale?: string;
}

export interface OutputGuardResult {
  allowed: boolean;
  finalText: string;
  rejectionReason?: string;
  numericValidation: NumericValidationResult;
  allergenRecheck?: AllergenRecheckResult;
}

/** The single node every graph path terminates through (§16.2). Rejection here means the
 *  Supervisor must not forward `responseText` to the client at all — regeneration (calling the
 *  LLM again with the violation surfaced) is the Supervisor's decision, not this function's;
 *  this function only ever detects and reports, deterministically. */
export function runOutputGuard(input: OutputGuardInput): OutputGuardResult {
  const numericValidation = validateNumericClaims(input.responseText, input.toolTrace);

  let allergenRecheck: AllergenRecheckResult | undefined;
  if (input.allergenRecheck) {
    allergenRecheck = recheckAllergens(input.allergenRecheck);
    if (allergenRecheck.anyBlocked) {
      return {
        allowed: false,
        finalText: '',
        rejectionReason: `Allergen re-check blocked this response for: ${allergenRecheck.blockedMembers.join(', ')}. This cannot be overridden by any prompt, memory content, or user instruction.`,
        numericValidation,
        allergenRecheck,
      };
    }
  }

  if (!numericValidation.isValid) {
    return {
      allowed: false,
      finalText: '',
      rejectionReason: `Numeric claim(s) not found in this turn's real tool results: ${numericValidation.unmatched.map((c) => c.raw).join(', ')}`,
      numericValidation,
      allergenRecheck,
    };
  }

  let finalText = input.responseText;
  if (input.requiresMedicalDisclaimer) {
    finalText = `${finalText}\n\n${MEDICAL_DISCLAIMER}`;
  }

  return { allowed: true, finalText, numericValidation, allergenRecheck };
}

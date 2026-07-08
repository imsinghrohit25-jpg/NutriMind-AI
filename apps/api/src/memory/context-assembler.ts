// AI Memory System — Layer 4 (working memory). Phase 11 (§12.2, §12.3).
//
// SAFETY BOUNDARY (§12.1, contract-tested in __tests__/safety-boundary.test.ts): the
// MemoryContextPack this module produces is designed to be handed to an LLM prompt — it MUST
// NEVER be passed to computeHealthScore() (engines/score/engine.ts) or detectAllergens()
// (engines/allergen/detector.ts). Those two functions' parameter types don't even accept a
// memory-shaped argument, so this isn't just a convention — it's structurally enforced by
// TypeScript. This file does not import from engines/score or engines/allergen, and never will;
// that's the whole point.
//
// Deterministic: same facts in → same context pack out. Rendering uses fixed templates per
// fact_key, never an LLM call — "the LLM only verbalizes" (§12.3) means it sees this pack as
// input, never generates the facts themselves.

import { createHash } from 'node:crypto';
import type { StoredMemoryFact } from './facts-service.js';

export interface MemoryContextPack {
  userId: string;
  generatedAt: string;
  sections: Record<string, string[]>;
  /** Lineage — every fact that contributed, so an audit can always trace context back to real
   *  user_events rows (via each fact's own derived_from). */
  factIds: string[];
  tokenEstimate: number;
  /** SHA-256 of the assembled text — logged for audit without persisting the raw personalized
   *  content itself. */
  contentHash: string;
}

const SECTION_ORDER: Array<StoredMemoryFact['factType']> = [
  'health_goal',
  'eating_pattern',
  'user_habit',
  'regional_cuisine_affinity',
  'seasonal_pattern',
  'family_preference',
  'travel_history',
];

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b\d{10,13}\b/g;

/** Defense-in-depth redaction for any free-text fact values — statistical facts are PII-free by
 *  construction, but this runs on every rendered line regardless, in case a future fact type
 *  ever carries user-typed text. */
function redact(text: string): string {
  return text.replace(EMAIL_RE, '[redacted-email]').replace(PHONE_RE, '[redacted-number]');
}

function renderFact(fact: StoredMemoryFact): string | null {
  const v = fact.value as Record<string, unknown>;
  switch (fact.factKey) {
    case 'active_goal':
      return `Current goal: ${v.goal}${v.kcalTarget ? ` (~${v.kcalTarget} kcal/day target)` : ''}.`;
    case 'current_streak_days':
      return `Currently on a ${v.streakDays}-day cooking streak.`;
    case 'adherence_rate':
      return `Followed the meal plan on ${v.adherencePct}% of the last ${v.windowDays} days.`;
    case 'cuisine_frequency':
    case 'cuisine_affinity_vector': {
      const dist = (v.distribution ?? v.affinity) as Record<string, number> | undefined;
      if (!dist) return null;
      const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
      return top ? `Cooks ${top[0]} cuisine most often (${Math.round(top[1] * 100)}% of meals).` : null;
    }
    case 'household_diet_type_distribution': {
      const dist = v.distribution as Record<string, number> | undefined;
      if (!dist) return null;
      const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
      return top ? `Household typically eats ${top[0]}.` : null;
    }
    case 'seasonal_produce_affinity':
      return `${v.affinityPct}% of recent purchases matched in-season produce.`;
    case 'travel_timeline':
      return v.travelMode ? `Currently traveling — recently in ${v.currentIsoCode}.` : null;
    default:
      if (fact.factKey.startsWith('meal_timing_')) {
        const mealType = fact.factKey.replace('meal_timing_', '');
        return `Usually has ${mealType} around ${v.avgHourUtc}:00 UTC.`;
      }
      if (fact.factKey.startsWith('plateau_')) {
        return v.isPlateau ? `${fact.factKey.replace('plateau_', '')} has plateaued over the last few weeks.` : null;
      }
      return null;
  }
}

/** ~4 characters/token is a standard, deterministic estimate — good enough for a context-pack
 *  budget without needing a real tokenizer dependency. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface AssembleOptions {
  /** Max tokens the assembled pack may occupy. Facts are dropped lowest-confidence-first per
   *  section once the budget is exceeded — deterministic, never random truncation. */
  maxTokens?: number;
}

export function assembleMemoryContext(
  userId: string,
  facts: StoredMemoryFact[],
  opts: AssembleOptions = {},
): MemoryContextPack {
  const maxTokens = opts.maxTokens ?? 400;
  const generatedAt = new Date().toISOString();

  const bySection = new Map<string, { fact: StoredMemoryFact; line: string }[]>();
  for (const factType of SECTION_ORDER) {
    const factsOfType = facts
      .filter((f) => f.factType === factType)
      .sort((a, b) => b.confidence - a.confidence); // highest-confidence facts survive truncation first
    const lines: { fact: StoredMemoryFact; line: string }[] = [];
    for (const fact of factsOfType) {
      const rendered = renderFact(fact);
      if (rendered) lines.push({ fact, line: redact(rendered) });
    }
    if (lines.length) bySection.set(factType, lines);
  }

  const sections: Record<string, string[]> = {};
  const factIds: string[] = [];
  let tokenEstimate = 0;

  for (const [factType, lines] of bySection) {
    const kept: string[] = [];
    for (const { fact, line } of lines) {
      const lineTokens = estimateTokens(line);
      if (tokenEstimate + lineTokens > maxTokens) break; // deterministic cutoff, lowest-confidence dropped first
      kept.push(line);
      factIds.push(fact.factId);
      tokenEstimate += lineTokens;
    }
    if (kept.length) sections[factType] = kept;
  }

  const contentHash = createHash('sha256').update(JSON.stringify(sections)).digest('hex');

  return { userId, generatedAt, sections, factIds, tokenEstimate, contentHash };
}

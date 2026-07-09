// Degradation ladder — Phase 12 (§13.5). Pure, deterministic classifier: given the current
// health signals (DB reachability, AI provider circuit-breaker states), which rung of the
// ladder the API is currently on.
//
// AI features degrade first and silently: `full` -> `ai_degraded` only changes what the AI
// gateway routes to (T2->T1 kill switch, gateway/model-tier.ts) or whether an LLM call is
// attempted at all; nothing about barcode resolve, meal view, or auth changes.
//
// Safety features (Health Score Engine, Allergen Hard Gates) are deliberately NOT represented
// anywhere in this ladder — they are pure functions with no I/O and no LLM dependency (§12.1's
// static-import-audit-tested boundary, memory/__tests__/safety-boundary.test.ts), so there is no
// signal in this file that could ever cause them to degrade. That is the point: a ladder rung is
// a statement about what CAN vary; the score/allergen engines structurally cannot.
//
// `reference_only` (DB unreachable) is the most severe rung this API can report about itself —
// full outage handling (steering traffic away from this region entirely) is Cloudflare's job
// (region/resolver.ts + DNS/traffic steering), not this process's.

export type DegradationLevel = 'full' | 'ai_degraded' | 'reference_only';

export interface DegradationInputs {
  dbReachable: boolean;
  aiCircuitOpen: boolean;
}

export interface DegradationStatus {
  level: DegradationLevel;
  dbReachable: boolean;
  aiCircuitOpen: boolean;
  reason: string;
}

export function computeDegradationLevel(inputs: DegradationInputs): DegradationStatus {
  if (!inputs.dbReachable) {
    return {
      level: 'reference_only',
      ...inputs,
      reason: 'Database unreachable — only edge-cached/static reference data can be served; writes will fail.',
    };
  }
  if (inputs.aiCircuitOpen) {
    return {
      level: 'ai_degraded',
      ...inputs,
      reason: 'An AI provider circuit breaker is open — AI features (copilot, recipe generation) degrade to fallback/queue; all non-AI paths are unaffected.',
    };
  }
  return { level: 'full', ...inputs, reason: 'All systems nominal.' };
}

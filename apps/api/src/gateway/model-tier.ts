// Model routing tiers — Phase 12 (§13.3). T0 (deterministic template, no LLM call at all), T1
// (small/fast model), T2 (frontier model, the pre-Phase-12 default for every tier). Selection is
// entirely deterministic from fields the caller sets explicitly (`intentTag`, `complexityHint`)
// or the global cost kill-switch — never inferred from message content, matching this codebase's
// existing "never guess, never divine" discipline (§12.1) for anything that changes model spend
// or behavior.

import type { LLMRequest } from '@nutrimind/shared';

export type ModelTier = 'T0' | 'T1' | 'T2';

/** Fixed-form responses that require no model call at all. Keyed by an explicit `intentTag` the
 *  caller sets — never pattern-matched against free-text content. Adding a new trivial response
 *  means adding a template here, not teaching the router to guess. */
const T0_TEMPLATES: Record<string, (vars: Record<string, string>) => string> = {
  ack_received: () => 'Got it — noted.',
  scan_confirmed: (v) => `Confirmed: ${v.productName ?? 'this item'} has been logged.`,
  goodbye: () => 'Take care — see you next time!',
};

export function isT0Eligible(intentTag: string | undefined): boolean {
  return intentTag != null && intentTag in T0_TEMPLATES;
}

export function renderT0Template(intentTag: string, vars: Record<string, string> = {}): string {
  const template = T0_TEMPLATES[intentTag];
  if (!template) throw new Error(`renderT0Template: unknown intentTag "${intentTag}"`);
  return template(vars);
}

/**
 * Resolves which tier a request should use. `killSwitchActive` (the runaway-cost governor,
 * §13.3) forces every T2-eligible request down to T1 globally — it never touches T0 (already
 * free) and never *raises* a request's tier.
 */
export function classifyModelTier(
  request: Pick<LLMRequest, 'intentTag' | 'complexityHint'>,
  killSwitchActive: boolean,
): ModelTier {
  if (isT0Eligible(request.intentTag)) return 'T0';
  if (killSwitchActive) return 'T1';
  if (request.complexityHint === 'low') return 'T1';
  return 'T2';
}

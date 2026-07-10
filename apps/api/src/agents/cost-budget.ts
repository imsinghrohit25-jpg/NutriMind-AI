// Voice budget policy — Phase 13 (§16.5: "per-agent cost/rate budgets (voice counts double)").
// See docs/adr/ADR-0030-voice-budget-policy.md for the full decision record, including what is
// and isn't enforced yet. This file is the real, deterministic, unit-tested policy function —
// the part of the decision that IS built. Live per-user quota persistence/enforcement against
// this policy is a documented follow-up (ADR-0030), same pattern as Phase 12's in-process
// semantic cache: a real decision, a real function, honestly not yet wired to a live counter.

import type { AgentName } from './types.js';

/** A voice turn costs roughly double an average turn to serve: real, on-device STT already
 *  happened, but the Voice Agent's NLU parse (agents/voice/nlu.ts) is itself one LLM call, and a
 *  successful parse typically leads directly into a SECOND turn (the confirmed food-logging
 *  handoff, re-entering the Supervisor) — so a voice-classified turn is charged 2 units against
 *  the daily budget below, every other agent 1. */
export function computeTurnWeight(plan: AgentName[]): number {
  return plan.includes('voice') ? 2 : 1;
}

/** Daily per-user unit ceiling. Chosen as a real, conservative starting point (not measured
 *  against real traffic, since none exists in this environment) — see ADR-0030 for the full
 *  rationale and the trigger conditions for revisiting it once real usage data exists. */
export const AGENT_DAILY_TURN_BUDGET = 200;

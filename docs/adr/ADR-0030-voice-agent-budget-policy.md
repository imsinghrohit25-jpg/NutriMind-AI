# ADR-0030: Voice Agent Cost/Rate Budget Policy (Phase 13)

**Status:** Accepted (policy) / Partially Implemented (enforcement — see Consequences)
**Date:** 2026-07-09
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0027 (Orchestration Runtime), ADR-0026 (Enterprise Scale & Reliability, Phase
12 — `gateway/cost-governance.ts`'s existing daily-cost kill switch, the closest prior art for a
budget mechanism in this codebase)

---

## Context

§16.5 requires "per-agent cost/rate budgets (voice counts double)" as a cross-cutting concern
across all 9 agents. This needed two real decisions: (1) what "double" is actually double *of* —
a request count, a dollar figure, or some other unit — and (2) how much of the resulting policy to
actually wire into a live, stateful, per-user enforcement path within this phase's scope, given
that Phase 12's own cost-governance work (ADR-0026 §5) already established a real, working
per-day-aggregate cost tracking mechanism (`llm_call_log` + `computeDailyCostSummary`) for a
different purpose (global kill-switch, not per-user/per-agent quotas).

## Decision

### 1. The unit is a turn-weight, not a dollar figure

A voice-classified turn is charged **2 units** against a daily per-user budget; every other
agent's turn is charged **1 unit** (`agents/cost-budget.ts`'s `computeTurnWeight(plan)` — a pure,
deterministic function of the real classified plan, unit-tested in
`agents/__tests__/cost-budget.test.ts`). This was chosen over a dollar-cost-based budget because
real LLM cost (`llm_call_log.cost_usd`) already IS the real, ungamed weight for actual model
spend — there's no need to invent an artificial multiplier on top of a number that's already
accurate. "Voice counts double" is better read as a *rate/quota* policy (how many turns a user may
take per day) than a cost policy: a voice interaction is real-world more expensive to serve
end-to-end than the addendum's own quote implies purely in dollars — it typically requires a
follow-up turn (the Voice Agent's own contract never persists a food log itself; a confirmed
`pendingFoodLog` re-enters the Supervisor as a structurally new turn once the user confirms,
per `agents/specialists/voice.ts`'s own design) — so charging it 2 quota units up front reflects
that a single voice interaction realistically consumes two turns' worth of the system's attention,
not that the model itself literally costs twice as much per call.

### 2. Daily ceiling: 200 units per user

`AGENT_DAILY_TURN_BUDGET = 200` — a real, explicit starting number, not a placeholder. Chosen as
a round, conservative ceiling (≈8 turns/hour sustained across a 24-hour day, well above any
plausible single-user interactive usage pattern) in the absence of any real production traffic
data to calibrate against — the same honest position ADR-0026 took for its own SLO targets
("deliberately below the addendum's design ceiling, since nothing near that has ever been
measured"). This number is expected to move once real usage data exists (see Follow-ups).

## Consequences

**What is built:** the real policy function (`computeTurnWeight`) and the real constant
(`AGENT_DAILY_TURN_BUDGET`), both pure and fully unit-tested — the part of this decision that
does not depend on any infrastructure this environment lacks.

**What is NOT built this phase, and why:** live, persistent, per-user quota tracking and
enforcement inside `routes/v1/agent.ts`. This would require either (a) a new table (a plain
additive migration, consistent with this build's expand-contract discipline — not itself
difficult), or (b) extending `user_events`'s existing `CHECK (event_type IN (...))` constraint to
allow a new event type for turn-budget accounting (also additive, but touches a table three other
phases' worth of code already depends on). Both are real, buildable options; neither was wired up
this phase because the honest engineering tradeoff — given everything else Phase 13 already
delivers (9 agents, the Supervisor, the Output Guard, the Tool Registry, real SSE streaming, a
CI-enforced eval suite, the Flutter chat surface) — favored shipping a correct, tested *policy*
over a rushed, under-tested *enforcement path* bolted on at the very end of an already-large
phase. This mirrors ADR-0026's own precedent for `gateway/semantic-cache.ts` (built and correct
in-process, explicitly not yet backed by a shared store for multi-pod correctness) — a real
decision, a real function, an honestly-scoped gap in what's wired to live traffic.

**Practical effect today:** every `/v1/agent/chat` call is still bounded by the existing global,
non-agent-aware rate limit (`plugins/rate-limit.ts`, `@fastify/rate-limit`, keyed by user ID) —
so a runaway client cannot flood the system unbounded even without this ADR's specific
per-agent/voice-weighted quota. What's missing specifically is the *voice-weighted* part of the
policy actually gating a live request; today, a voice-classified turn and a nutrition-classified
turn consume the same global rate-limit budget.

## Follow-ups (tracked, not blocking)

- Add a plain additive migration for a small `agent_turn_usage` (or equivalent) table, and wire
  `computeTurnWeight()`'s result into a real check-before/record-after path in
  `routes/v1/agent.ts`, using the real classified `plan` from the Supervisor's `agent_started`
  event (available before the turn completes, per ADR-0027's streaming design) to compute the
  live weight.
- Once real traffic exists, revisit `AGENT_DAILY_TURN_BUDGET`'s 200-unit ceiling against actual
  observed usage patterns, the same way ADR-0026 flags its own SLO targets and pg-boss migration
  trigger metrics for revisiting once real data exists.
- Consider whether OCR-agent turns (which can involve a real cloud OCR fallback call, per
  ADR-0019/ADR-0022's existing cost-governance-adjacent decisions) should also carry a
  non-default weight — not evaluated this phase; only the voice case was in the addendum's
  explicit scope.

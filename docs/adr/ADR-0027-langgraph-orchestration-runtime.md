# ADR-0027: Multi-Agent Orchestration Runtime — LangGraph.js (Phase 13)

**Status:** Accepted
**Date:** 2026-07-09
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0028 (Tool Contract Design), ADR-0029 (Numeric-Validation Strategy), ADR-0030
(Voice Budget Policy) — the other three Phase 13 decision records; ADR-0026 (Enterprise Scale &
Reliability, Phase 12 — the AI gateway/cost-governance layer every agent's tool calls sit on top
of)

---

## Context

The master prompt addendum's §16.2 names "One orchestration runtime (LangGraph.js Supervisor) on
the backend" as a governing principle, not an open choice — the runtime decision itself was
already made in the spec. What remained a real decision for this build: how to *use* LangGraph.js
without letting it become a second, competing source of control flow alongside the codebase's
existing "deterministic engines, LLM only for explanation" discipline (§16.1.1's own framing,
directly descended from the Health Score Engine / Allergen Detector's "pure functions, no LLM
writes" contract that every phase since Phase 1 has kept intact).

Two supervisor topologies were possible with LangGraph.js's `StateGraph`:

1. **One node per agent**, with `addConditionalEdges` computing pairwise routing between all 9
   agents (a full routing table), matching how most LangGraph multi-agent tutorials are written.
2. **One `dispatch` node with a self-loop**, iterating a pre-computed sequential plan
   (`AgentName[]`) one step at a time, re-entering the same node until the plan is exhausted.

## Decision

**Option 2 — a single dispatch node with a conditional self-loop
(`agents/supervisor.ts`).** The `classify` node (wrapping `intent-classifier.ts`) produces the
entire ordered plan up front — a multi-intent message like "main agle hafte Dubai ja raha hoon,
meal plan adjust karo" resolves to `['travel_nutrition', 'meal_planning', 'grocery']` in one pass
— and `dispatch` simply advances `currentStep` through that list, calling
`agentRegistry[plan[currentStep]]` each time, until `addConditionalEdges('dispatch', ...)` routes
to `guard` once `currentStep >= plan.length`.

This was chosen over the N-node routing-table approach for three concrete reasons, not just
preference:

1. **A 9×9 conditional routing table is itself undeclared control flow the addendum's own §16.1.3
   contract-testing requirement would need to cover** — every one of 72 possible pairwise
   transitions becomes a thing that could silently be wrong. A single dispatch node reading a
   plan array that was already fully computed by `classify` has exactly one loop condition to get
   right (`currentStep < plan.length`), verified directly in
   `agents/__tests__/supervisor.test.ts`.
2. **The handoff contract stays uniform.** Every `SpecialistAgentRunner` (`agent-runner.ts`) takes
   the same `{message, ctx, registry, locale, handoffState}` shape and returns the same
   `{responseText, toolTrace, handoffState?, ...}` shape regardless of position in the plan — a
   single dispatch node enforces this structurally (there is only one call site), where N
   hand-wired edges would each need their own state-shape agreement.
3. **LangGraph.js's own `.stream()` (default `streamMode: "updates"`) yields exactly the granular
   node-completion payload this architecture needs for real progress events** —
   `{classify: {...}}`, then one `{dispatch: {...}}` chunk per real agent execution, then
   `{guard: {...}}` — verified directly against the real compiled graph (not assumed from docs)
   before `agents/supervisor.ts`'s `runSupervisorStream()` was written around it. This is what
   `routes/v1/agent.ts`'s SSE endpoint streams to the Flutter client as real `agent_started`/
   `tool_call`/`tool_result`/`agent_handoff` events — genuine incremental delivery of the graph's
   actual execution, not an artificial re-chunking of an already-complete response.

Every graph path terminates through the `guard` node before `END` — there is no edge from
`dispatch` to `END` — which is what makes §16.1.4's "safety is topology, not prompt text" claim
structurally true rather than aspirational: it is not possible to add a tenth agent to this graph
without also routing it through `guard`, because there is no other edge to `END` to accidentally
use.

## Why the final answer is not token-streamed

`runSupervisorStream()`'s own doc comment (and ADR-0029, in more depth) covers this, but it bears
restating here since it's a direct consequence of this graph shape: the Output Guard is the LAST
node before `END`, and its verdict can flip a response from allowed to rejected based on real
tool-trace/allergen data the client has no visibility into mid-stream. Token-streaming the final
answer as it's generated — before the guard has run — would mean a client could see a few hundred
milliseconds of a response that then gets retracted, which is worse than not streaming it at all
for a safety-critical surface. The lifecycle events (classification, each tool call, each
handoff) stream in real time; the validated answer itself arrives whole, in the `done` event, only
after `guard` has actually run.

## Consequences

- LangGraph.js's own checkpointing/persistence layer (`@langchain/langgraph-checkpoint`, already
  present transitively) is NOT used — the Supervisor is invoked fresh per HTTP request
  (`routes/v1/agent.ts`), with no cross-turn conversation state persisted server-side. The
  addendum's §16.2 calls for "State persisted per-conversation (Postgres, region-pinned)" —
  **not built this phase.** Each `/v1/agent/chat` call is a single, complete turn; a follow-up
  message (e.g. confirming a Voice Agent's `pendingFoodLog`) is a structurally NEW request that
  happens to carry forward client-side state (the mobile app's own `AgentTurn`/handoffState), not
  a continuation of a server-side LangGraph checkpoint. This is an honest, real limitation, not
  a silently-dropped requirement — see the Follow-ups section.
- Because `classify` always runs first and produces the complete plan, a genuinely *reactive*
  multi-agent conversation (where agent N's real output could change which agent N+1 should be,
  mid-turn) is not possible with this shape — the plan is fixed once classification completes.
  None of the 9 agents' real specifications need this (each hands off *structured state*, not a
  routing decision, to the next agent in an already-fixed sequence), so this is not a gap against
  the addendum's actual §16.4 agent specs, only against a more dynamic topology this build did not
  need.

## Follow-ups (tracked, not blocking)

- Wire LangGraph.js's checkpointer to real Postgres (`@langchain/langgraph-checkpoint-postgres` or
  equivalent) so a conversation genuinely persists server-side across turns, closing the §16.2
  "State persisted per-conversation" gap noted above.
- If a future agent's real spec needs conditional re-routing mid-plan (not true of any of the
  current 9), revisit the single-dispatch-node shape — LangGraph.js supports it, this build simply
  didn't need it yet.

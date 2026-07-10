# ADR-0028: Shared Tool Registry — Tool Contract Design (Phase 13)

**Status:** Accepted
**Date:** 2026-07-09
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0027 (Orchestration Runtime), ADR-0029 (Numeric-Validation Strategy)

---

## Context

§16.1.1's governing principle — "Agents orchestrate and explain. Engines compute. No agent may
calculate calories, macros, scores, prices, or allergen safety itself" — and §16.1.3's allowlist
contract ("An agent calling a tool outside its allowlist is a runtime error") together require a
single chokepoint every agent's every data/engine access passes through, with per-agent
permissions enforced at the point of the call, not just at graph-construction time. The design
question was where that chokepoint lives and how "runtime error, not a warning" is made real
rather than aspirational.

## Decision

### 1. One registry, two entry points, asymmetric trust

`agents/tool-registry.ts`'s `ToolRegistry` class exposes:

- `call(name, input, ctx)` — **unrestricted**, no allowlist check. Used exactly once in the whole
  system: by the Output Guard (`agents/output-guard.ts`'s `recheckAllergens`, which actually calls
  `engines/allergen/*` directly, not even through the registry — see ADR-0029) and by tests
  constructing an isolated tool call. No specialist agent module ever calls `call()` directly.
- `callAsAgent(agentName, toolName, input, ctx, allowlist)` — the **only** entry point a
  specialist agent's own code (`agents/specialists/*.ts`) uses, always through
  `agent-runner.ts`'s `makeAgentToolCaller()` helper, which closes over the calling agent's name
  and its declared allowlist (`agent-specs.ts`'s `AGENT_TOOL_ALLOWLISTS`) so an agent module can
  never accidentally pass the wrong allowlist for itself.

The allowlist check happens **inside `callAsAgent`, on every single call**, not once at graph
construction or node-registration time. This is what makes "a compromised/adversarial prompt that
convinces an LLM to 'call' an unlisted tool still can't actually reach it" a structural fact
(verified directly: `agents/__tests__/adversarial-safety.test.ts`'s tool-allowlist-violation suite
calls `callAsAgent` with real agent/tool/allowlist combinations and asserts a real
`ToolNotAllowedError` throw, not a mocked one) rather than a property that depends on every future
agent's author remembering to check permissions themselves.

### 2. Allowlists are passed explicitly, not looked up internally

`callAsAgent`'s signature takes `allowlist: readonly ToolName[]` as an explicit parameter — the
registry itself does NOT look up `AGENT_TOOL_ALLOWLISTS[agentName]` internally. This was a
deliberate rejection of the more convenient-looking alternative (`callAsAgent(agentName, tool,
input, ctx)` with an internal lookup), for one reason: an internal lookup that ever returned
`undefined` for an unrecognized or newly-added agent name would need a fallback, and any fallback
other than "throw" risks silently defaulting to "allow everything" the one time a lookup fails —
exactly the failure mode §16.1.3 says must never happen. Requiring the caller
(`agent-runner.ts`'s `makeAgentToolCaller`) to supply the allowlist explicitly means there is
exactly one place (`agent-specs.ts`) that defines what an agent may do, and the registry itself
has no code path that could ever "forget" to enforce it.

### 3. The registry is intentionally untyped at the storage layer, re-typed at every call site

`ToolRegistry`'s internal `Map<ToolName, ToolDefinition<unknown, unknown>>` and its constructor
parameter (`ToolDefinition<any, any>[]`) are deliberately loosely typed — 19 tools with mutually
incompatible input/output shapes cannot share one precise generic without either a large
discriminated union (brittle against the tool count growing) or `any` at the collection boundary.
Real type safety is recovered at every individual call site instead: `call<TInput,
TOutput>(name, ...)` and `callAsAgent<TInput, TOutput>(...)` take their own generic parameters,
so e.g. `nutrition.ts`'s `call<{product}, NutritionComputeOutput>('nutrition.compute', ...)` is
fully typed against the real tool contract, even though the registry storing it isn't. This
mirrors an already-established pattern in this codebase (`gateway/router.ts`'s adapter registry
takes the same approach for heterogeneous LLM provider clients).

### 4. Every tool wraps a pre-existing engine; zero tools compute anything new

All 19 tools (`agents/tools/*.ts`) are thin wrappers: `nutrition.compute` calls
`engines/score/engine.ts`'s `computeHealthScore` (unchanged since Phase 1); `allergen.check` calls
`engines/allergen/detector.ts` + `fail-safe.ts` (unchanged); `mealplan.generate`/`optimize` call
`planner/meal-plan-generator.ts`; `biomarker.trends` uses a newly-extracted
`stats/linear-regression.ts` (`computeOlsRegression`) shared with Phase 11's plateau-detection
code, not a new statistics implementation. The one addition beyond the addendum's explicit §16.3
table is `family.members` (`agents/tools/family.ts`) — documented directly in
`agents/types.ts`'s `ToolName` union comment as a real, necessary addition: the Family Agent needs
per-member diet/allergen profiles across real separate user accounts (the existing
`family/family-service.ts`'s `FamilyMember` type is a group-membership record with no diet data at
all — a different concept), and no existing tool provided that join. This new tool wraps the
existing `family_members` + `users_profiles` tables under the same RLS-membership model already
built in an earlier phase, not a new data model.

## Consequences

- Every specialist agent's "pipeline" (which tools it calls, in what order, under what condition)
  is fixed, ordinary TypeScript control flow inside its own module — there is no dynamic,
  LLM-decided tool selection anywhere in this system. This is a deliberate consequence of §16.1.1
  ("agents orchestrate... engines compute"), not an accidental simplification: the LLM is invoked
  exactly once per agent turn, at the very end, only to phrase already-computed real data
  (`agents/explain.ts`'s `explainWithFallback`), never to decide what to compute or which tool to
  call next.
- Because tool selection is fixed code, not LLM-driven, prompt injection cannot make an agent call
  a tool it wasn't already going to call — there is no reachable code path from "text in the
  user's message" to "which tool gets invoked." The adversarial suite's allergen-bypass and
  numeric-fabrication tests exploit the one place an LLM's output DOES reach the user (the final
  explain step's phrasing) precisely because that's the only place a compromised model could
  inject anything at all; the Output Guard (ADR-0029) is what catches it there.

## Follow-ups (tracked, not blocking)

- If a future agent genuinely needs dynamic, LLM-selected tool calling (not true of any of the
  current 9), the allowlist-enforcement design here already supports it structurally — the
  allowlist check doesn't care whether the caller is fixed code or an LLM's tool-call response,
  only that the tool name is in the declared list. Wiring an actual LLM tool-calling loop through
  `callAsAgent` is unbuilt, not unsupported.

# ADR-0029: Output Guard — Numeric-Validation Strategy (Phase 13)

**Status:** Accepted
**Date:** 2026-07-09
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0027 (Orchestration Runtime — the Supervisor graph shape that guarantees every
path terminates through this guard), ADR-0028 (Tool Contract Design — the tool trace this guard
validates against)

---

## Context

§16.1.1: "LLM output that contains numbers must quote tool results verbatim — a post-response
validator checks every numeric claim against the tool trace and rejects the response (or requests
regeneration) on mismatch." §16.1.4: "Safety is topology, not prompt text" — the guard must be
structurally unbypassable, not a prompt instruction the model could be talked out of. Two designs
were possible:

1. **Ask the LLM to self-report its own claims** (e.g. a structured "here are the numbers I used
   and where they came from" side-channel the model fills in alongside its answer), checked
   against the trace.
2. **Independently re-derive every fact the guard cares about from real data, ignoring anything
   the agent or LLM claims about itself**, and text-mine the actual response for numeric claims
   using deterministic pattern matching, never asking the model anything.

## Decision

**Option 2, in full, for both of the guard's two checks** (`agents/output-guard.ts`):

### 1. Numeric-claim validation — regex extraction, not LLM self-report

`extractNumericClaims()` runs three deterministic patterns against the final response text —
`UNIT_CLAIM_REGEX` (mg/g/kcal/ml/%/mmHg/mmol/IU/µg/mcg), `SCORE_CLAIM_REGEX` (`NN(.N)/100`), and
`RUPEE_CLAIM_REGEX` (₹/Rs figures) — extending copilot's pre-existing
`grounding-verifier.ts`'s base numeric-claim pattern with this domain's other common shapes
(health scores, Indian rupee prices) it didn't cover. `collectTraceNumbers()` deep-walks every
real tool-call output from this turn (`ToolTraceEntry[]`, populated by `agent-runner.ts`'s
`makeAgentToolCaller` on every `callAsAgent` call) and collects every number found, rounding to 2
decimals (and also allowing the plain rounded integer) so a claim like "72.5" matches a trace
value of `72.5000000001` from upstream floating-point arithmetic. A claim is invalid if it matches
neither the trace's real numbers nor a rounding of them. **The LLM is never asked what its numbers
mean or where they came from** — this is why the check cannot be prompt-injected around: there is
no instruction in the guard's own code path that references the agent's or LLM's own claims about
itself at all, only the text it produced and the trace that was actually computed.

This was chosen over LLM self-report because a self-reporting side-channel is itself just another
piece of LLM output, subject to exactly the same fabrication risk as the answer it's meant to
verify — a compromised model asked to "list the sources for your numbers" can fabricate that list
as readily as it fabricated the number. Independent re-derivation has no such recursion problem:
regex extraction and a trace walk are pure functions with no model in the loop.

**Real, found-and-fixed bug during this phase:** `SCORE_CLAIM_REGEX` originally didn't allow a
decimal point before `/100` (`/\b(\d{1,3})\s*\/\s*100\b/g`), so "72.5/100" matched only "5/100" —
silently truncating a real score claim to the wrong digits. Fixed to
`/\b(\d{1,3}(?:\.\d+)?)\s*\/\s*100\b/g`, caught by this file's own test suite before it ever
reached the adversarial suite.

**Real, found-and-fixed bug during eval-suite construction (Task 26):** the OCR Agent's receipt
reconciliation warning (`agents/specialists/ocr.ts`) computed a sum of item prices in its own
JavaScript (`items.reduce(...)`) and quoted that computed sum directly in the response text — a
direct violation of §16.1.1 ("no agent may calculate... itself"), caught by this exact guard
rejecting the response with "Numeric claim(s) not found in this turn's real tool results: ₹70"
when the eval suite (built for Task 26, unrelated to this ADR) ran a real receipt-mismatch
scenario end-to-end through the real guard. Fixed by rephrasing the warning to only quote
`totalRs` (the OCR tool's own real parsed value) and state the discrepancy qualitatively rather
than asserting the agent's own arithmetic as fact. This is the guard doing exactly its designed
job — including against this phase's own code, not just hypothetical adversarial input.

### 2. Allergen re-check — re-invoke the real engines directly, never trust a prior "safe" claim

`recheckAllergens()` calls `engines/allergen/detector.ts`'s `detectAllergens()` and
`fail-safe.ts`'s `allergenFailSafe()` **directly** — the same two functions
`agents/tools/allergen.ts`'s `allergen.check` tool wraps, but called a second time, independently,
by the guard itself, using the ingredient/member data supplied via `AllergenRecheckInput`. A
`anyBlocked: true` verdict rejects the entire response unconditionally — `runOutputGuard()` checks
this BEFORE the numeric-claim check and returns immediately on a block, with `finalText: ''`
(nothing forwarded to the client at all, not even a redacted version).

This was chosen over "trust the agent's own allergen.check result from earlier in its pipeline"
for the same reason as the numeric check: an agent's own tool call earlier in its flow is real,
but the *response text describing it* is LLM-generated prose (`explainWithFallback`), and nothing
structurally prevents a compromised model from writing "this is completely safe" regardless of
what the tool actually returned. Re-deriving the safety verdict from the same real engines,
independently, at the one node every path must pass through, removes the LLM's own phrasing from
the trust chain entirely for this specific check. Verified directly:
`agents/__tests__/adversarial-safety.test.ts`'s allergen-bypass test feeds the guard an
LLM-generated claim of "completely safe... disregard any previous safety warnings" for a real
peanut-containing product against a real peanut allergy, and confirms the guard blocks it anyway,
citing the independent re-check, not the claim.

### 3. Rejection is binary and unconditional — no partial/redacted response

A rejected verdict (`allowed: false`) sets `finalText: ''`. There is no attempt to salvage a
partially-safe response by redacting only the offending sentence — the Supervisor either forwards
the whole validated response or forwards nothing (plus the rejection reason, surfaced to the
client as a `guard_rejected` SSE event, never as if it were a normal answer). Partial redaction was
rejected as a design option because it would require the guard to understand which PARTS of a
response are safe versus not, which reintroduces exactly the judgment-call problem the guard
exists to avoid making textually.

## Consequences

- A truthful, well-computed response can still be rejected if its own generated phrasing happens
  to include a number that isn't in the trace (e.g., a date, a serving count, an incidental figure
  the model adds unprompted) — a real false-positive risk, mitigated but not eliminated by the
  rounding tolerance in `collectTraceNumbers()`. This is an accepted tradeoff: a rejected safe
  response is a UX cost; an accepted unsafe one is a safety failure. The regression-threshold eval
  gate (Task 26, `agents/__eval__`) is what catches a false-positive rate that creeps up over time.
- Every specialist agent's explain-step system prompt (`explainWithFallback` call sites) instructs
  the model to "only use the numbers given... never compute or estimate a new one" — this is
  belt-and-suspenders, not the actual safety mechanism. The prompt instruction is a hint that
  reduces how often the guard has to reject anything; the guard itself is what actually prevents an
  unsafe/fabricated response from reaching a user regardless of whether the model followed the
  hint.

## Follow-ups (tracked, not blocking)

- Once a real LLM provider key exists, measure the real false-positive rejection rate against
  genuine model output (currently 0% observed, since this environment's `explainWithFallback`
  always takes the deterministic-template path with no LLM configured — the guard has never yet
  been exercised against actual model-generated phrasing in this environment).
- Consider a bounded regeneration loop (§16.1.1 mentions "or requests regeneration" as an
  alternative to outright rejection) once a real provider is configured — not built here; the
  current behavior is reject-only.

# ADR-0025: AI Memory System (Phase 11)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0008 (Health Score Engine), ADR-0009 (Allergen Guardian), ADR-0017/ADR-0021
(consent/DSR infrastructure this phase extends), ADR-0022 (route-registration discipline this
phase follows)

---

## Context

The master prompt addendum for Phases 11–12 specifies a four-layer AI Memory System: episodic
event log, deterministically-aggregated derived profile, retrieval-only semantic memory, and a
token-budgeted working-memory context assembler feeding an LLM. Its governing principle (§12.1):
**memory personalizes, but must never influence the Health Score or Allergen Gates** — those stay
pure, deterministic, and rule-based regardless of what a user's memory system believes about
them. This ADR documents what was built, and — following this build's established discipline of
finding real defects while extending the exact files needed for a phase's legitimate work — a
significant migration-chain defect this phase's verification work uncovered.

---

## Decision

### 0. First real migration-chain verification this entire build track (major finding)

Before writing anything new, migration 0023 needed to be checked against a real database — this
build's local Supabase Postgres instance (Docker, previously provisioned but never actually
exercised against the current migration set) was used to apply migrations 0001–0024 in sequence
for the first time. Two real, previously undetected defects surfaced:

1. **`feature_flags` (migration 0017) could never have been created against a real database.**
   `PRIMARY KEY (key, COALESCE(country_code, ''))` is not valid PostgreSQL — a `PRIMARY KEY`
   constraint can only reference columns, never an expression. Every `global.pN.*` flag
   read/write across this entire ten-phase build track depended on this table existing.
2. **A silent table-name collision.** Migration 0009 (original 19-phase build) already created
   a *different* `feature_flags` table (`id, name, is_enabled, rollout_percent, description,
   updated_at`) for that build's own flagging needs. Migration 0017's `CREATE TABLE IF NOT
   EXISTS feature_flags` therefore silently no-op'd against a real database — the old,
   incompatible schema would have won, and every `global.pN.*` read (`routes/v1/flags.ts`,
   `country/plugin.ts`) would have failed with "column does not exist."

Both fixed in `0017_feature_flags.sql`: the superseded 0009 table is dropped (confirmed zero
references to its columns anywhere in this codebase — dead, pre-launch, no production data to
preserve, same rationale as ADR-0018's `estimated_rs` rename) and the real table created fresh,
with a surrogate `id` primary key and a `UNIQUE INDEX` on `(key, COALESCE(country_code, ''))`
(indexes, unlike table constraints, support expressions). The same NULL-uniqueness pitfall was
found and fixed pre-emptively in this phase's own new `seasonal_produce` table before it ever
shipped. All 24 migrations now apply cleanly to a real database, verified via an isolated
throwaway database inside the same Docker Postgres instance (never touching the pre-existing
`postgres` database of unknown provenance). This verification technique — and the local Supabase
stack's existence at all — should be used for every future migration in this project.

### 1. Layer 1 — Episodic memory (`apps/api/src/memory/events.ts`, migration 0023)

`user_events`: append-only, RANGE-partitioned by month (`ensure_user_events_partition()`
helper + a rolling 2-months-back/3-months-ahead pre-created window). This is real, standard
Postgres time-partitioning matching the 24-month retention policy — **not** the same thing as
user-hash cross-node sharding for 100M-user horizontal scale, which needs a distributed Postgres
topology (Citus, or per-region Supabase projects per ADR's Phase 7 region model) and is a
separate infra decision out of this migration's scope.

`recordEvent()`/`recordEventBestEffort()` — best-effort, never blocks the primary action (same
pattern as `resolve.ts`'s existing embedding enqueue). Wired as real dual-writes into every
genuine existing write path this build has: `resolve.ts` (barcode_scanned), `pantry.ts` +
`receipt-ocr.ts` (grocery_purchase), `biomarker.ts` (biomarker_reading), `planner.ts`
(meal_planned on generate, recipe_cooked on mark-complete, grocery_purchase on purchase-toggle),
`onboarding.ts` (country_transition), `data-rights.ts` (goal_set on rectify). **Not** wired:
`food_logged`, `meal_skipped`, `restaurant_visit` — this build has no free-text meal-logging
route, no meal-skip action, and no restaurant-visit-logging route to attach them to. The event
type taxonomy defines them for forward-compatibility; emission is an honest gap, not fabricated.

### 2. Layer 2 — Derived profile (`apps/api/src/memory/aggregation/*.ts`, `facts-service.ts`)

Seven fact taxonomies, each a **pure, deterministic function** `(events) → FactCandidate[]` —
no I/O, no LLM calls, no randomness. Confidence scales with real sample size
(`confidenceFromSampleSize`), never an LLM's self-reported certainty. Every fact carries
`derivedFrom: eventId[]` lineage — "derived, never divined" (§12.1) enforced structurally, not
just by convention.

- **eating_pattern**: meal timing (avg hour from real `recipe_cooked` timestamps), cuisine
  frequency, weekday/weekend cooking-frequency delta.
- **user_habit**: logging cadence (median gap between any two events), scan-frequency (a real
  count — **not** a fabricated "scan vs. search" comparison; this build has no user-attributed
  search event to compare against), snacking window.
- **health_goal**: active goal (latest `goal_set`), current streak, 14-day adherence rate, and
  **plateau detection via real ordinary-least-squares linear regression** over `biomarker_reading`
  events (§12.2's explicit "statistical, not LLM" requirement) — near-zero weekly slope over 4+
  readings.
- **family_preference**: household diet-type distribution from cooked/planned meals. Scope note:
  `user_events` is account-scoped, not per-household-member-attributed (no member-tagging UI
  exists) — the account's own diet-type distribution is a legitimate proxy since meal plans serve
  the whole household by design, but per-member splitting is a named, tracked gap, not fabricated.
- **regional_cuisine_affinity**: ranked cuisine frequency from cooked meals + restaurant visits.
- **travel_history**: chronological timeline from `country_transition` events; `travelMode` flag
  when 2+ distinct countries appear in the trailing 30 days.
- **seasonal_pattern**: purchased/cooked item names string-matched against real, cited seasonal
  produce data for the user's country/month (§4 below) — never an LLM guess at what's in season.

Persisted via `persistFacts()` — upsert on `(user_id, fact_type, fact_key)`, `valid_until`
computed from each fact's own TTL (half-life decay per §12.1). RLS grants owners SELECT/DELETE
but not INSERT/UPDATE (migration 0023) — only the service-role aggregation job can write facts;
a user can inspect and delete, never fabricate, their own memory.

### 3. Scheduling — pg-boss, not Kubernetes CronJobs

The addendum names K8s CronJobs for scheduled aggregation workers, but explicitly scopes that
infrastructure to **Phase 12** (§13, Enterprise Scale), and this build track already has a real,
working recurring-job system (pg-boss, used since Phase 0 for weekly reports and embeddings —
`schedule: true` was already configured in `jobs/boss.ts` but never actually used).
`jobs/registry.ts` registers `aggregate-memory-facts` (per-user, real handler calling
`runMemoryAggregationJob()`) and `aggregate-memory-facts-fanout` (finds users with events in the
last 24h, enqueues one job per user), scheduled via `boss.schedule(..., '0 */6 * * *', {})` —
every 6 hours, called once at worker startup (`worker.ts`). This is a real, working trigger
mechanism today; migrating the trigger to a K8s CronJob (keeping the same aggregation logic
underneath) is explicitly Phase 12 scope. Unlike this build's four pre-existing job registrations
(`weekly-report`, `embed-product`, `embed-knowledge-chunk`, `embed-user-history` — all
`console.log` stubs never wired to their real handler implementations in `jobs/handlers/*.ts`,
a gap found but not fixed here, out of Phase 11's scope), this phase's new job calls real logic.

### 4. Seasonal produce reference data (migration 0024, `memory/seasonal-produce-data.ts`)

Real, cited monthly calendars for the 8 Tier-1 countries (ICAR/National Horticulture Board for
India, USDA for the US, Eat Seasonably/UK FDF for the UK, Hort Innovation Australia — correctly
Southern-Hemisphere-inverted, Foodland Ontario for Canada, BZfE Saisonkalender for Germany).
UAE gets a reduced 5-month winter-desert-farming calendar with an explicit note that most produce
is imported year-round; Singapore gets **no** calendar at all (Singapore Food Agency: >90% of
food imported, no meaningful domestic season to cite) — an honest empty result, not a fabricated
list. The TS module is the canonical source; migration 0024 seeds the same data into the
`seasonal_produce` table (generated from the TS source via a one-off script, not hand-transcribed,
to eliminate copy errors) so it's queryable/editable without a deploy.

### 5. Layer 3 — Semantic memory (`apps/api/src/memory/embeddings-service.ts`)

`user_memory_embeddings` (pgvector, already-enabled extension since migration 0001) +
`match_user_memory()` RPC, mirroring `match_scan_history`'s (migration 0011) RLS-safe
`SECURITY DEFINER` pattern. Uses the existing `gateway.embed()` (same embeddings task-tier used
by `embeddings/product-pipeline.ts` since Phase 0) — no new embedding provider. Retrieval/ranking
only; **never** a fact source, never written to `user_memory_facts`.

Verified empirically (not just assumed from documentation) that PostgREST correctly serializes a
plain JS number array into a `vector` column: a throwaway table was created in the local Postgres
instance, an HTTP `POST` through the real Kong/PostgREST gateway confirmed
`[0.1,0.2,0.3]` round-trips correctly, then the throwaway table was dropped. No other file in
this codebase writes to a `vector` column via the Supabase JS client (`product-pipeline.ts` uses
raw SQL with an explicit `::vector` cast) — this was a genuine unverified assumption worth
checking before committing to the pattern.

### 6. Layer 4 — Working memory (`apps/api/src/memory/context-assembler.ts`, `ranker.ts`)

`assembleMemoryContext()`: deterministic, fixed-template rendering per `fact_key` (never an LLM
call — "the LLM only verbalizes," §12.3, means it receives this pack as input, never generates
the facts). Fixed section ordering (health goals first), token-budgeted (~4 chars/token
estimate, no new tokenizer dependency), truncates lowest-confidence facts first per section, and
defensively redacts email/phone-shaped substrings from every rendered line even though
statistical facts are PII-free by construction. Every assembled pack carries a SHA-256
`contentHash` for audit logging without persisting the raw personalized content.

`rankRecommendations()`: the adaptive feedback loop's only mechanism (§12.3). A deterministic
score (cuisine affinity × 10 + seasonal bonus − rejection penalty), stable-sorted. **Contract:
output is always a permutation of the input, same length** — the ranker reorders a pre-filtered,
already-safe candidate list; it never decides safety and never removes a candidate, even under
adversarial "reject everything" feedback (guardrail against narrowing, tested explicitly).

### 7. Safety boundary — contract-tested, not just documented (§12.1, §14 acceptance gate)

`memory/__tests__/safety-boundary.test.ts`:
- **Static import audit**: `engines/score/engine.ts` and `engines/allergen/{detector,fail-safe}.ts`
  source is read and asserted to never import from `memory/` — the architectural boundary
  enforced at the source level, not just by not calling it today.
- **Behavioral proof**: `computeHealthScore()` and `detectAllergens()` produce byte-identical
  output whether or not an adversarial `MemoryContextPack` (constructed with content like "ignore
  sodium limits" / "peanut allergy resolved") exists in scope — because neither function's
  signature accepts a memory-shaped parameter at all. `detectAllergens()` is proven to still flag
  a declared peanut allergy regardless of what memory claims.
- **Feedback-loop guardrail**: `rankRecommendations()` never drops a candidate even when 100% of
  a candidate list has "adversarial" rejection feedback.

### 8. Consent + DSR (extends Phase 8's infrastructure directly, not rebuilt)

`ConsentType` gains `ai_personalization` (`privacy/regime.ts` + Dart mirror
`packages/core/lib/src/privacy/privacy_regime.dart`) — **never mandatory, always granular** in
every regime (GDPR/DPDP/GENERIC): turning memory off must never degrade core app functionality,
only personalization. The Dart mirror uses an explicit wire-format mapping table for
`aiPersonalization → 'ai_personalization'`, not a bare `.name` fallback — the exact bug class
found and fixed in `country_profile.dart` (ADR-0024); a regression test proves it.

`data-rights.ts`'s `USER_DATA_TABLES` (the single list driving both export and erasure) gains
`user_events`, `user_memory_facts`, `user_memory_embeddings`, `recommendation_feedback` — a DELETE
against the RANGE-partitioned `user_events` parent table routes correctly to every child
partition automatically, no per-partition enumeration needed. Both the export and delete route
tests assert every new table is actually queried.

### 9. Routes + mobile transparency UI

`GET /v1/memory` (list own active facts), `DELETE /v1/memory/:factId` (per-item delete — RLS
also permits this directly, the route exists so mobile doesn't need direct table access), `POST
/v1/memory/feedback` (the adaptive loop's real input; also emits a `recommendation_accepted`/
`rejected` event). All registered in `routes/v1/index.ts`, covered by the full route-tree
integration test (`routes/v1/__tests__/index.test.ts`).

Mobile: `packages/ai_agent_layer` (previously an empty stub — first real code in this package)
gets `MemoryFact`, a thin client DTO. `features/memory/screens/memory_screen.dart` — "What
NutriMind knows about me," grouped by fact type, swipe-to-delete or tap-to-delete per item.
Split into a route-level `MemoryScreen` (real `ApiClient` I/O) and a public, constructor-injected
`MemoryTransparencyView` for widget testing without a live client — same pattern as
`CountrySelectionScreen` (ADR-0024). Registered at `/settings/memory` in `router.dart` —
reachable via direct navigation, **not yet linked from a settings/profile entry point** (this app
has no built settings shell yet — the same already-documented gap as `DataRightsScreen`,
`ApiClient`'s lack of a DI seam, and most of `features/`; not solved here, not fabricated as
solved).

---

## Consequences

- **Fixed a defect that has been silently blocking every phase's flag system since before this
  rebuild started.** No prior phase's `global.pN.*` flag work in this session was ever run
  against a real database until now.
- Aggregation logic is 100% unit-testable without any database or LLM dependency — pure functions
  over synthetic event fixtures. This is the highest-value part of the memory system and also the
  cheapest to verify exhaustively.
- The safety boundary is enforced at three levels: type signatures (structural), static import
  analysis (architectural), and behavioral tests (functional) — not just a paragraph in this ADR.
- Honest scope reductions, all documented rather than fabricated: no `food_logged`/
  `meal_skipped`/`restaurant_visit` event emission (no route to attach them to), family
  preferences are account-scoped not member-scoped, Singapore has no seasonal produce data,
  four pre-existing job stubs remain unwired (out of this phase's scope), the memory screen isn't
  linked from a settings nav (none exists yet).
- Real infrastructure was used to verify, not just written and assumed correct: the full 24-file
  migration chain was applied to a real Postgres instance (twice, after each defect found), and
  the pgvector array-serialization assumption was verified via a live HTTP round-trip through the
  real Kong/PostgREST gateway.

## Follow-ups (tracked, not blocking)

- Phase 12: migrate the aggregation job's trigger from pg-boss cron to a K8s CronJob per the
  addendum's own phasing; wire the four pre-existing stub job handlers to their real
  implementations while touching this file again.
- Build a mobile settings shell and link `DataRightsScreen`/`MemoryScreen` from it.
- Add a free-text meal-logging route so `food_logged`/`meal_skipped` events have a real emission
  point (currently only planned-meal completion is tracked).
- Per-household-member event attribution for genuinely-split family preference facts.

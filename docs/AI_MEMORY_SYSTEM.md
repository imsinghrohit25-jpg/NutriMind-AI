# AI Memory System — Phase 11 Reference

**Effective:** 2026-07-08 · **Phase:** 11 (Global Enterprise Edition)
**Flag:** `global.p11.ai_memory_system`
**Related:** [ADR-0025](adr/ADR-0025-ai-memory-system.md)

## Architecture — four layers

```
user_events (Layer 1, episodic, append-only)
      │  aggregation/*.ts — pure deterministic functions
      ▼
user_memory_facts (Layer 2, derived profile, decays via valid_until)
      │
      ├──► context-assembler.ts (Layer 4, working memory) ──► LLM prompt
      │
user_memory_embeddings (Layer 3, semantic, retrieval only) ──┘
```

**Golden rule (§12.1):** memory personalizes, never gates. `computeHealthScore()`
(`engines/score/engine.ts`) and `detectAllergens()` (`engines/allergen/detector.ts`) do not
import from `memory/` and their signatures cannot accept a memory-shaped parameter — enforced by
a static import audit + behavioral tests in `memory/__tests__/safety-boundary.test.ts`.

## Event taxonomy (`memory/types.ts`)

| Event type | Real emission point | Status |
|---|---|---|
| `barcode_scanned` | `resolve.ts` POST /resolve/barcode | wired |
| `grocery_purchase` | `pantry.ts` item add, `receipt-ocr.ts` per parsed item, `planner.ts` purchase-toggle | wired |
| `biomarker_reading` | `biomarker.ts` manual lab entry | wired |
| `meal_planned` | `planner.ts` POST /planner/generate (per meal) | wired |
| `recipe_cooked` | `planner.ts` PATCH /planner/items/:id/complete | wired |
| `country_transition` | `onboarding.ts` POST /onboarding/country | wired |
| `goal_set` | `data-rights.ts` PATCH /rectify (when `goal` present) | wired |
| `recommendation_accepted`/`rejected` | `memory.ts` POST /memory/feedback | wired |
| `feedback_given` | — | defined, no emission point yet |
| `food_logged` | — | defined, no free-text meal-logging route exists |
| `meal_skipped` | — | defined, no "skip" action exists |
| `restaurant_visit` | — | defined, restaurant routes don't log a visit event |

## Fact taxonomy (`memory/aggregation/*.ts`)

All pure functions: `(events: StoredMemoryEvent[]) => FactCandidate[]`. No I/O, no LLM, no
randomness — same input always produces the same output.

| Fact type | Fact keys | TTL |
|---|---|---|
| `eating_pattern` | `meal_timing_<type>`, `cuisine_frequency`, `weekday_weekend_delta` | 60d |
| `user_habit` | `logging_cadence`, `scan_frequency`, `snacking_window` | 30–45d |
| `health_goal` | `active_goal`, `current_streak_days`, `adherence_rate`, `plateau_<biomarker>` | 1–90d |
| `family_preference` | `household_diet_type_distribution` | 90d |
| `regional_cuisine_affinity` | `cuisine_affinity_vector` | 90d |
| `travel_history` | `travel_timeline` | 180d |
| `seasonal_pattern` | `seasonal_produce_affinity` | 31d |

`plateau_<biomarker>` uses real ordinary-least-squares linear regression over
`biomarker_reading` events — a near-zero weekly slope over 4+ readings, not an LLM estimate.

## Scheduling

`jobs/registry.ts` registers `aggregate-memory-facts` (per-user, real handler) and
`aggregate-memory-facts-fanout` (finds users active in the last 24h, enqueues per-user jobs),
scheduled via pg-boss cron (`0 */6 * * *`, every 6 hours) from `worker.ts` startup. This is the
real trigger mechanism today — migrating it to a Kubernetes CronJob (same underlying logic) is
explicit Phase 12 scope per the master addendum.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /v1/memory` | required | List own active memory facts (transparency UI) |
| `DELETE /v1/memory/:factId` | required | Per-item delete |
| `POST /v1/memory/feedback` | required | Recommendation feedback — the adaptive loop's only input |

## Consent + DSR

`ai_personalization` consent purpose (`privacy/regime.ts`) — never mandatory, always granular,
in every regime. DSR export/erasure (`data-rights.ts`) cascades to `user_events`,
`user_memory_facts`, `user_memory_embeddings`, `recommendation_feedback`.

## Mobile

`packages/ai_agent_layer` — `MemoryFact` DTO (first real code in this previously-stub package).
`features/memory/screens/memory_screen.dart` — "What NutriMind knows about me," grouped by fact
type, swipe or tap to delete. Registered at `/settings/memory`; reachable via direct navigation,
not yet linked from a settings entry point (no settings shell exists in this app yet).

## Known gaps (tracked, not fabricated as solved)

- `food_logged`/`meal_skipped`/`restaurant_visit` events have no real emission point.
- Family preference facts are account-scoped, not per-household-member.
- Four pre-existing pg-boss job registrations (`weekly-report`, `embed-product`,
  `embed-knowledge-chunk`, `embed-user-history`) remain `console.log` stubs, unrelated to this
  phase's scope.
- `MemoryScreen` has no settings-shell entry point to be linked from.

# ADR-0020: Multi-Region Routing & Edge Caching (Phase 7)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0014 (CountryProfile DI), ADR-0018 (grocery/restaurant intelligence — origin of
the graceful-degradation deferral pattern reused here), ADR-0019 (OCR & voice AI — same pattern
applied to `cloud_stt`/`wake_word`)

---

## Context

NutriMind runs as a single Fastify API deployment against a single Supabase project
(`project_id = "nutrimind"`), with no region configured in `supabase/config.toml` beyond local
dev defaults. `supabase/migrations/0017_feature_flags.sql` seeded two Phase 7 flags:
`global.p7.multi_region_routing` (ADR-0013: "Edge routing + residency") and
`global.p7.edge_caching`. As in Phases 5–6, this phase implements what's real and buildable
without new infrastructure this environment cannot provision, and is explicit about what it
defers.

---

## Decision

### 1. `edge_caching` — implemented

`docs/PERFORMANCE.md` already targets "API barcode resolution (cache hit) < 100 ms p50," backed
by the existing Postgres-backed cache (`datasources/openfoodfacts/cache.ts`, checked as
"Step 1: DB cache" in `resolution/waterfall.ts`) — but every cache "hit" still costs a
network round-trip to Postgres (3 queries: `products`, `product_nutrition`,
`product_ingredients`). `cache/edge-cache.ts`'s `EdgeCache<V>` is a generic in-process TTL cache
(same Map + TTL + periodic-eviction shape as the existing `gateway/cache.ts`'s `GatewayCache`,
generalized), wired into `resolveBarcode()` in both `resolution/waterfall.ts` and
`resolution/country-waterfall.ts` as a new "Step 0" checked before the DB cache. A hit skips the
DB entirely; a DB-cache or fresh-OpenFoodFacts result populates it for next time. `WaterfallDeps`
gained an optional trailing `edgeCache` field — omitting it (every pre-Phase-7 caller) is
byte-identical to existing behavior, same "optional, additive, byte-identical when omitted"
pattern as ADR-0018 §1's `provider` parameter and ADR-0019 §1's `formatId` parameter.
`app.ts` instantiates one `EdgeCache<CanonicalProduct>` per process and decorates Fastify with it
(`fastify.productCache`); `routes/v1/resolve.ts` passes it into `resolveBarcode()`.

Negative results (`not_found`) are intentionally **not** cached — each miss enqueues a real
curation-queue entry (`enqueueCuration`), and caching a miss would suppress that side effect for
a barcode that might resolve on a subsequent scan attempt.

`resolveByName()` was left unchanged: its results depend on IFCT/CoFID whole-food name search,
which is already a cheap in-memory lookup, not a network round-trip, so the same caching
wouldn't produce a comparable latency win.

### 2. `multi_region_routing` — routing/residency decision implemented; infra deferred

`region/registry.ts` + `region/resolver.ts` implement `resolveDataRegion(isoCode)`: a real,
tested policy engine mapping each of the 25 registered countries to the AWS-style region
(matching Supabase's supported project regions) its traffic/data *should* target —
`eu-west-1` for the 6 EU/UK-GDPR countries in `COUNTRY_REGISTRY` (GB, DE, FR, IT, ES, NL —
GDPR Regulation (EU) 2016/679; UK GDPR mirrors it post-Brexit via the Data Protection Act 2018),
`us-east-1` for North America (US, CA, MX), `ap-south-1` (the default anchor) for everyone else.

Only `ap-south-1` (Mumbai) is an actually-provisioned Supabase project + API deployment today.
Provisioning `eu-west-1`/`us-east-1` and building cross-region data replication/routing
infrastructure to act on a non-default `target` requires real cloud infrastructure this
environment cannot provision — the same category of deferral as ADR-0018 §2's restaurant-chain
dataset and ADR-0019 §3/§4's cloud STT/wake-word provider credentials. Rather than silently
under-deliver, `resolveDataRegion()` returns both `target` (the policy decision) and `active`
(`ap-south-1`, always, today), plus a `residencySatisfied` flag that is honestly `false` for
every EU/UK-GDPR country until `eu-west-1` exists — this makes the compliance gap visible to
callers instead of claiming a residency guarantee NutriMind cannot yet deliver.

`GET /api/v1/flags` gained a new `region` field (the resolved `DataRegionResolution` for the
requesting user's country) — purely additive; no existing field or consumer's parsing changes,
so (consistent with ADR-0018 §3/ADR-0019 §1's reasoning for other net-new response fields) no
flag gate was needed for this particular wiring.

`packages/country_engine`'s `data_region.dart` mirrors the decision logic client-side
(`targetRegionFor`, `residencyRequiredFor`, `resolveDataRegion`) — duplicated rather than
round-tripped through an API call, since (like `voice_engine`'s `sttStrategyFor`, ADR-0019 §3)
it depends only on data (`CountryProfile.isoCode`) the client already has locally.

---

## Alternatives Considered

### A. Provision real `eu-west-1`/`us-east-1` Supabase projects now
Rejected: no cloud account/credentials to provision additional projects exist in this
environment, and even if they did, cross-region data replication/routing is a substantial
infrastructure project (choosing a replication strategy, handling split-brain, migrating
existing India-resident rows) out of proportion to a single phase. Shipping the routing
*decision* now, with the infra gap named explicitly, unblocks that future work without
fabricating a guarantee.

### B. Silently default `residencySatisfied` to `true` to avoid an awkward "not compliant yet" field
Rejected: this is exactly the kind of specific, checkable compliance claim ("this EU user's data
stays in the EU") the project's honest-uncertainty discipline (ADR-0018 §"Alternatives", the
`isEstimated`/`confidence` pattern throughout) exists to prevent fabricating.

### C. Use a third-party CDN/edge-compute product (Cloudflare Workers KV, etc.) for the caching layer
Rejected: no credentials for a new external service exist in this environment. An in-process
`EdgeCache` achieves the same p50-latency goal for a single-process deployment without a new
unproven dependency — consistent with ADR-0019 §"Alternatives" B's reasoning for reusing existing
infrastructure over adding a new one.

---

## Consequences

**Positive:**
- Repeat barcode scans within the cache TTL window now skip the DB round-trip entirely — real,
  measured latency improvement toward the documented `docs/PERFORMANCE.md` target, with zero
  behavior change when `edgeCache` is omitted (530-test API suite passes unchanged).
- `resolveDataRegion()` gives every future region-aware feature (routing middleware, a
  region-aware Supabase client, a data-migration job) a single, tested source of truth to build
  against, instead of each inventing its own country→region mapping.
- The residency gap is now a named, queryable fact (`residencySatisfied: false`) rather than an
  undocumented assumption.

**Negative:**
- `multi_region_routing` does not actually route any traffic or data differently by region yet —
  every request is served by the same `ap-south-1` deployment regardless of `target`. No
  timeline is set for provisioning additional regions.
- `EdgeCache` is per-process, in-memory, and unbounded across process restarts — a multi-instance
  deployment would have per-instance cache populations (no shared invalidation), which is
  acceptable for a read-through cache of otherwise-DB-cached data (worst case: an extra DB
  round-trip, never stale/incorrect data beyond the existing DB cache's own TTL) but is a real
  limitation worth knowing before scaling horizontally.
- Cached negative lookups are intentionally not implemented, so a barcode that repeatedly
  resolves to `not_found` still hits the DB/OFF/curation path on every attempt.

---

## Acceptance Gate (Phase 7)

- [x] TypeScript: 0 regressions with `edgeCache` omitted from `WaterfallDeps` (530-test suite passes)
- [x] `EdgeCache.get()` returns `undefined` for a missing/expired key and the correct value for a live one
- [x] `resolveBarcode()` skips the DB entirely on a second call within the TTL once `edgeCache` is wired in (asserted via `sql` mock call count in both `waterfall.test.ts` and `country-waterfall.test.ts`)
- [x] `not_found` results are never cached (curation entries keep being created on every miss)
- [x] `resolveDataRegion()` returns `eu-west-1`/`true` for all 6 EU/UK-GDPR countries, `us-east-1` for US/CA/MX, `ap-south-1` otherwise
- [x] `residencySatisfied` is `false` for every residency-required country while `ACTIVE_REGION` is `ap-south-1`
- [x] `packages/country_engine`'s `data_region.dart` mirrors and stays in sync with the TS decision logic
- [ ] `eu-west-1`/`us-east-1` Supabase project provisioning (blocks `multi_region_routing` becoming a functional routing/residency guarantee — no owner/timeline yet)
- [ ] Cross-region data replication/migration strategy (prerequisite for the above)

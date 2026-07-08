# Multi-Region Routing & Edge Caching — Phase 7 Reference

**Effective:** 2026-07-08 · **Phase:** 7 (Global Enterprise Edition)
**Flags:** `global.p7.edge_caching`, `global.p7.multi_region_routing` (routing decision only, no
additional regions provisioned)
**Related:** [ADR-0020](adr/ADR-0020-multi-region-edge-caching.md),
[PERFORMANCE.md](PERFORMANCE.md) (the barcode-resolution cache-hit latency target this phase
targets)

## Edge cache

`apps/api/src/cache/edge-cache.ts`'s `EdgeCache<V>` is a generic in-process TTL cache (5-minute
default TTL, 5,000-entry cap with oldest-first eviction). It sits in front of the existing
DB-backed product cache in `resolution/waterfall.ts` and `resolution/country-waterfall.ts`'s
`resolveBarcode()`: a repeat lookup for the same barcode within the TTL window is served entirely
from process memory — no SQL round-trip at all.

| Layer | Latency | Backing |
|---|---|---|
| Edge cache (new, Phase 7) | in-process, no I/O | `EdgeCache<CanonicalProduct>`, 5 min TTL |
| DB cache (existing, Phase 3+) | one Postgres round-trip (3 queries) | `public.products` + related tables, 168 hr TTL |
| OpenFoodFacts / IFCT / USDA | network round-trip | External APIs |

Only positive resolutions are cached — a `not_found` result still runs the full waterfall and
enqueues a curation-queue entry on every attempt, since caching a miss would suppress that.

## Data region routing

| Country group | Target region | Why |
|---|---|---|
| GB, DE, FR, IT, ES, NL | `eu-west-1` | GDPR (EU 2016/679) / UK GDPR residency |
| US, CA, MX | `us-east-1` | Latency (North America) |
| Everyone else (IN, AE, SG, AU, JP, KR, BR, ID, TH, MY, PH, VN, ZA, NG, EG, SA, GLOBAL) | `ap-south-1` | Default anchor — the one live region |

`apps/api/src/region/resolver.ts`'s `resolveDataRegion(isoCode)` returns `{ target, active,
residencyRequired, residencySatisfied }`. **`active` is always `ap-south-1` today** — no other
region is actually provisioned, so `residencySatisfied` is honestly `false` for every EU/UK
country until `eu-west-1` exists. `GET /api/v1/flags` now includes this as a `region` field.

## Known gaps (tracked, not blocking Phase 7)

- `multi_region_routing` does not route any traffic differently by region — every request is
  served by `ap-south-1` regardless of `target`. No owner/timeline for provisioning additional
  regions.
- `EdgeCache` is per-process/in-memory; a multi-instance deployment gets independent cache
  populations (no shared invalidation) — never stale-incorrect, just occasionally an extra DB
  round-trip other instances would've avoided.
- Pre-existing (unrelated to this phase): 2 tests in
  `packages/country_engine/test/resolution_chain_test.dart` fail on this branch
  (`Step 5: stored last-known fallback`, `unknown override falls through to next step` — both
  expect `AU`, get `US`). Confirmed via `git diff` that Phase 7 touched none of
  `resolution_chain.dart`, `country_registry.dart`, or that test file — this predates Phase 7 and
  is not addressed here.

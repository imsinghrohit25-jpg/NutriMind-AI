# ADR-0023: Incremental Regional Sync & Deferred Components (Phase 9)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0016 §6 (Phase 3 defined `RegionalFoodPack` as a descriptor-only placeholder,
explicitly deferring sync mechanics to this phase), ADR-0022 (route-registration audit this
phase continues from)

---

## Context

`supabase/migrations/0017_feature_flags.sql` seeded two Phase 9 flags:
`global.p9.incremental_regional_sync` and `global.p9.deferred_components`. Per
`NutriMindFlagKeys`'s own section comment ("Phase 9 — Performance"), both are performance
features. ADR-0016 §6 already scoped `incremental_regional_sync`: Phase 3 built
`RegionalFoodPack` as a manifest-only model with a placeholder `downloadUrl` pointing at
`cdn.nutrimind.app` — a CDN that was never provisioned — and explicitly deferred "actual
download/install mechanics" to this phase.

---

## Decision

### 1. `incremental_regional_sync` — implemented for real, backed by real (if often unavailable) datasets

`apps/api/src/packs/{types,registry,sync-service}.ts` + `routes/v1/packs.ts`:
- `GET /v1/packs` — manifest of known packs (currently IFCT 2017/India and CoFID 2021/UK — see
  §3 for why USDA isn't included) with **real** `itemCount`/`available` fields sourced from the
  already-existing `IfctLoader`/`CofidLoader` (`.count`/`.size`, both newly added — additive,
  read-only accessors), never a placeholder number.
- `GET /v1/packs/:packId/sync?version=<cached>` — the actual sync mechanics ADR-0016 deferred.
  IFCT/CoFID are versioned as a whole dataset release, not per-row with individual
  `updated_at` timestamps, so a row-level delta isn't meaningful the way it would be for a
  live-updated table. "Incremental" here means version comparison: if the client's cached
  `datasetVersion` matches the server's, the response is an empty, `upToDate: true` diff
  (skips re-sending ~500-8000 items the client already has); otherwise it's the full current
  snapshot. This is the honest shape of "incremental" for a versioned-whole reference dataset —
  fabricating row-level timestamps IFCT/CoFID don't actually have would be worse than admitting
  the real granularity.
- Both endpoints degrade gracefully (empty manifest entries / empty sync results, `available:
  false`) when a dataset isn't loaded — same contract as `IfctLoader.isAvailable()` /
  `CofidLoader.isAvailable()` already had. **Neither the IFCT nor CoFID dataset file is present
  in this environment** (same licensing gap as risk R-01, tracked since Phase 0) — the endpoints
  are real and fully tested (via loader mocks, standard unit-testing practice, not fabrication),
  but return empty/unavailable in this deployment today.
- `CofidLoader` was previously constructed only inside `country-waterfall.ts` (itself unwired —
  see ADR-0022), so nothing ever actually instantiated it. `app.ts` now decorates
  `fastify.cofid` the same way it already decorated `fastify.ifct`.

### 2. Dart client + fixed a second `/api/v1` vs `/v1` defect

`packages/food_intelligence/lib/src/regional_food_pack.dart` dropped the fabricated
`cdn.nutrimind.app` `downloadUrl`/static `kKnownRegionalPacks` list entirely — the manifest now
comes from the server (`FoodIntelligenceService.fetchPackManifest()`), matching the project's
established "server is the single source of truth, no duplicated/stale client data" principle
(ADR-0016 §5). Added `syncPack()` and a `RegionalFoodPack.needsSync` getter (true only when the
server has the dataset available AND the client's cached version doesn't match).

**Found and fixed while extending this exact service file with new HTTP calls**: its *existing*
`resolveBarcode()`/`resolveByName()` methods called `$baseUrl/api/v1/resolve/...` — the real,
registered path (confirmed via `routes/v1/index.ts`'s `{ prefix: '/v1' }`) is `$baseUrl/v1/
resolve/...`. This is the same defect class as ADR-0022's `voice.ts`/`data-rights.ts` findings,
just on the mobile client instead of the server, and it was **the only Dart file in the entire
`packages/` tree that makes a real HTTP call to the backend at all** — every other package is
metadata/thin-client only, per ADR-0016 §5's design intent. It had zero test coverage before
this phase; the new `food_intelligence_service_test.dart` (a hand-rolled `HttpClientAdapter`
fake, no new pubspec dependency) now asserts the real resolved URL for all four HTTP-calling
methods, which is what would have caught this the first time.

### 3. `deferred_components` — real Dart-level mechanism, Android on-demand-download benefit unverified

Flutter's official "Deferred Components" feature (Android-only, via Play Feature Delivery) sits
on top of Dart's native `deferred as` library-import mechanism. This environment has no Android
SDK installed (`flutter doctor` confirms), so the Android-specific on-demand-module-download
build/verification cannot be exercised here. What *is* real and verified: `apps/mobile/lib/core/
router/deferred_route.dart` (a `DeferredRoute` widget wrapping `loadLibrary()` with a loading/
error state) and `router.dart`'s scanner route now use a genuine `deferred as scanner_lib`
import — the scanner screen pulls in the `camera` plugin, not needed until the user actually
navigates there. Verified via `flutter analyze` (catches real deferred-import syntax/type
errors) and 4 new widget tests exercising the loading → loaded and loading → error transitions.

**Also found, out of scope to fix**: `apps/mobile/lib/app.dart` fails `flutter analyze` for
reasons entirely unrelated to this phase (missing generated `l10n/app_localizations.dart`, a
`nutrimind_localization_engine` import not declared as a pubspec dependency) — confirmed via
`git diff` this file was untouched. This blocks a full mobile app build/analyze regardless of
Phase 9. Also noted in passing: `router.dart` wires only 9 of the ~30 directories under
`features/`; most mobile screens are, like the pre-Phase-9 backend routes (ADR-0022), built but
never reachable from the app's navigation. Neither is addressed here — both are large, separate,
pre-existing gaps.

---

## Alternatives Considered

### A. Fabricate row-level `updated_at` sync semantics for IFCT/CoFID
Rejected: neither dataset's real source format has per-row change timestamps — inventing them
would misrepresent the actual sync granularity to any future client relying on it.

### B. Include USDA FDC as a third syncable pack
Rejected: USDA is a live API client (`datasources/usda/client.ts`), not a locally-loaded bulk
dataset — "sync a snapshot" isn't the same operation for it. Bulk-downloading and locally
caching the full USDA FDC database would be a materially different, much larger effort (their
bulk export is tens of GB) than reusing the already-loaded IFCT/CoFID in-memory datasets.

### C. Attempt to provision an Android SDK in this environment to fully verify Deferred Components
Rejected: out of proportion to this phase and not something achievable within a coding-agent
session without pre-existing SDK/license provisioning. The Dart-level mechanism (which IS fully
verifiable here) is shipped; the Android-specific benefit is named as a tracked gap rather than
claimed without evidence.

---

## Consequences

**Positive:**
- `RegionalFoodPack` no longer references a CDN that doesn't exist — the manifest and sync data
  now come from a real, tested API surface backed by the same loaders the barcode-resolution
  waterfall already uses.
- A second, real `/api/v1` vs `/v1` production-breaking client bug is fixed and now has
  regression coverage, in the one Dart file that actually makes HTTP calls to the backend.
- The scanner route no longer eagerly loads the `camera` plugin at initial route-table
  construction time — genuine (if modest, single-route) startup-cost improvement, backed by a
  reusable `DeferredRoute` pattern for any future heavy screen.

**Negative:**
- IFCT/CoFID sync is real but currently always returns `available: false` in this deployment —
  no licensed dataset file exists here (same R-01 gap since Phase 0). No owner/timeline.
- The Android Play-Feature-Delivery on-demand-download benefit of deferred components is
  unverified — only the Dart-level lazy-loading mechanism is proven here. No owner/timeline for
  an environment with Android SDK access.
- `app.dart`'s pre-existing `flutter analyze` failures (missing l10n, undeclared dependency)
  block a full mobile app build/analyze and were not fixed here.
- Most `features/` directories remain unreachable from `router.dart`'s navigation graph — a
  mobile-side parallel to ADR-0022's backend finding, not addressed in this phase.

---

## Acceptance Gate (Phase 9)

- [x] `GET /v1/packs` returns real `itemCount`/`available` per pack (never fabricated)
- [x] `GET /v1/packs/:packId/sync` returns an empty `upToDate: true` diff both when the client's version matches AND when the dataset isn't available; the full snapshot otherwise
- [x] `packs/sync-service.ts` unit tests + `routes/v1/packs.ts` route tests pass (14 new tests)
- [x] `RegionalFoodPack` carries no fabricated CDN URL; manifest is fetched from the server
- [x] `FoodIntelligenceService.resolveBarcode()`/`resolveByName()` call `/v1/...`, not `/api/v1/...` (regression-tested — previously zero coverage)
- [x] `DeferredRoute` shows a loading state during `loadLibrary()`, the real screen once resolved, and an error state on failure (4 widget tests)
- [x] Full API suite green (639/639 after this phase's additions), 0 regressions; `tsc --noEmit` clean
- [x] `flutter analyze`/`flutter test` clean on `packages/food_intelligence` and the router/deferred-route mobile code specifically
- [ ] Licensed IFCT 2017 / CoFID 2021 dataset acquisition (blocks `incremental_regional_sync` returning real data — no owner/timeline, same as risk R-01)
- [ ] Android SDK access to verify the Play-Feature-Delivery on-demand-download benefit of `deferred_components` (no owner/timeline)
- [ ] `app.dart`'s pre-existing missing-l10n/undeclared-dependency failures (found, not fixed — blocks full mobile app analyze/build)

# Regional Pack Sync & Deferred Components — Phase 9 Reference

**Effective:** 2026-07-08 · **Phase:** 9 (Global Enterprise Edition)
**Flags:** `global.p9.incremental_regional_sync`, `global.p9.deferred_components`
**Related:** [ADR-0023](adr/ADR-0023-incremental-regional-sync-deferred-components.md),
[ADR-0016](adr/ADR-0016-unified-food-database.md) §6 (origin of the `RegionalFoodPack` model)

## Regional pack sync

| Endpoint | Purpose |
|---|---|
| `GET /v1/packs` | Manifest: every known pack's real item count + availability |
| `GET /v1/packs/:packId/sync?version=<cached>` | Empty diff if up to date; full snapshot otherwise |

Known packs (`apps/api/src/packs/registry.ts`):

| Pack ID | Country | Source | Loader |
|---|---|---|---|
| `ifct_in_2017` | IN | IFCT 2017 | `IfctLoader` |
| `cofid_gb_2021` | GB | CoFID 2021 | `CofidLoader` |

USDA is not a pack — it's a live API client, not a locally-loaded snapshot; "sync" isn't a
meaningful operation for it the way it is for a bulk-loaded reference dataset.

**"Incremental" means version comparison, not row-level deltas.** IFCT/CoFID ship as whole
dataset releases without per-row `updated_at` timestamps, so a client either already has the
current version (empty response) or needs the full current snapshot (one-time, until the next
version bump). This is the honest sync granularity for this kind of dataset.

**Neither dataset is present in this environment** (same licensing gap tracked since Phase 0,
risk R-01) — both endpoints are real and tested, but return `available: false` / empty results
here. `IfctLoader`/`CofidLoader` gained `.getAll()`/`.count`/`.size` accessors to support this;
no other behavior changed.

## Mobile client

`FoodIntelligenceService.fetchPackManifest()` / `.syncPack(pack)` replace the old static
`kKnownRegionalPacks` list and its fabricated `cdn.nutrimind.app` download URLs — the manifest
now comes from the server. `RegionalFoodPack.needsSync` is true only when the server has the
dataset available *and* the device's cached version doesn't match.

**Also fixed in the same file**: `resolveBarcode()`/`resolveByName()` were calling
`$baseUrl/api/v1/resolve/...` — the real path is `$baseUrl/v1/resolve/...` (no `/api` prefix;
`routes/v1/index.ts` registers everything under `{ prefix: '/v1' }`). This was a real,
production-breaking bug with zero prior test coverage — every barcode/name resolution call from
the mobile client would have 404'd.

## Deferred components

`apps/mobile/lib/core/router/deferred_route.dart`'s `DeferredRoute` widget wraps a Dart
`deferred as` library import: shows a loading indicator while `loadLibrary()` resolves, the real
screen once it does, an error state if it fails. Applied to the scanner route
(`router.dart`) — the `camera` plugin is no longer pulled in until the user navigates there.

**Scope note:** this verifies the real Dart-level deferred-loading mechanism (`flutter analyze`
+ widget tests). It does not verify Flutter's Android-specific "Deferred Components" feature's
on-demand Play Feature Delivery module download — that requires Android Gradle
`dynamicFeatures` configuration and a release AAB build, and this environment has no Android SDK
installed (`flutter doctor` confirms).

## Known gaps (tracked, not blocking Phase 9)

- IFCT 2017 / CoFID 2021 dataset acquisition — no owner/timeline (risk R-01, since Phase 0).
- Android SDK access to verify the Play Feature Delivery on-demand-download benefit — no
  owner/timeline.
- `apps/mobile/lib/app.dart` fails `flutter analyze` for pre-existing, unrelated reasons (missing
  generated `l10n/app_localizations.dart`, an undeclared `nutrimind_localization_engine`
  dependency) — found while verifying this phase's mobile changes, confirmed via `git diff` to
  predate Phase 9, not fixed here.
- Most `features/` directories aren't reachable from `router.dart`'s navigation graph — a
  mobile-side parallel to [ADR-0022](adr/ADR-0022-route-registration-audit.md)'s backend
  finding, not addressed here.

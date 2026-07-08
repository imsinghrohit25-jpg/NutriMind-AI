# Country Onboarding v2 — Phase 10 Reference

**Effective:** 2026-07-08 · **Phase:** 10 (Global Enterprise Edition — last of the 28 currently-seeded flags)
**Flag:** `global.p10.country_onboarding_v2`
**Related:** [ADR-0024](adr/ADR-0024-country-onboarding-v2.md)

## Flow

1. After consent + disclaimer, the router routes to `AppRoutes.countrySetup`
   (`/onboarding/country`) before profile setup.
2. `CountrySelectionScreen` calls `GET /v1/onboarding/country`, which returns the country the
   existing server-side header-based resolution chain already resolved (`suggested`) plus the
   full registry (`countries`).
3. The user confirms the suggestion or picks a different country from a searchable list
   (`CountryPickerList`).
4. Confirming calls `POST /v1/onboarding/country`, which persists `preferred_country` (the
   choice) and `detected_country` (what was auto-resolved) to `users_profiles` — the first time
   either column (added in migration 0018, table name fixed in ADR-0022) has ever been written.
5. `CountryProfileNotifier.setOverride()` updates local state; a `country_v2` Drift flag marks
   the step complete, gating entry the same way `consent_v1`/`disclaimer_v1` already do.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /v1/onboarding/country` | none | Suggested country + full picker list |
| `POST /v1/onboarding/country` | required | Persist the explicit choice |

## Fixed: `CountryProfile` JSON serialization

`fromJson()`/`toJson()` previously used `.name`/`.byName()` on `AllergenRegime`/
`NutritionStandard`, which only matched Dart's own enum identifiers (`fssai8`) — never the real
server values (`FSSAI_8`). This would have crashed the moment any code parsed a real API
response through this model; nothing had, until this phase's onboarding screen. Fixed with
explicit wire-format mapping tables; the Dart enum member names themselves (used as identifiers
throughout `country_registry.dart`/`nutrition_rules`) are unchanged.

## Also fixed: `apps/mobile` now passes `flutter analyze` cleanly, app-wide

ADR-0023 (Phase 9) found `app.dart` failing `flutter analyze` for reasons unrelated to that
phase (missing generated l10n files, an undeclared `nutrimind_localization_engine` dependency).
Adding `nutrimind_country_engine` as a real dependency for this phase's screen triggered
`flutter pub get`, which regenerated the missing l10n files as a normal side effect; adding
`nutrimind_localization_engine` (same one-line fix as `nutrimind_country_engine`) resolved the
rest. `flutter analyze` is now clean across the entire mobile app, not just the files Phase 9/10
touched directly.

## Known gaps (tracked, not blocking Phase 10)

- `ApiClient` (`core/network/api_client.dart`) has no dependency-injection seam, so
  `CountrySelectionScreen`'s full fetch-and-save flow isn't integration-tested — only its
  presentational sub-widgets are. Refactoring `ApiClient` touches ~17 other screens; out of
  scope here.
- The server-side resolution chain still doesn't read `preferred_country` from the DB — by
  design (the mobile client fetches it once and forwards the result via the `x-user-country`
  header), but a future non-mobile client would need to replicate that.
- Only `CountryProfile`'s enum-wire-format mismatch was found/fixed; other Dart models with
  enum-typed fields haven't been audited for the same class of bug.
- Most `features/` directories are still unreachable from `router.dart`'s navigation graph
  (found Phase 9) — `flutter analyze` passing doesn't mean these screens are wired into the app,
  only that they compile.

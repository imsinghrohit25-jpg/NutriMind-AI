# ADR-0024: Country Onboarding v2 (Phase 10)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0014 (CountryProfile DI), ADR-0022 (fixed migration 0018's `users_profiles`
table-name bug this phase finally makes use of)

---

## Context

`supabase/migrations/0017_feature_flags.sql` seeded the last of the 28 currently-registered
flags: `global.p10.country_onboarding_v2`. Investigating what "v2" implied revealed the country
resolution engine (`packages/country_engine`) was essentially complete but entirely
disconnected: `CountryProfileNotifier.init()` was never called from anywhere in the app,
`countryProfileProvider` had zero consumers, and `nutrimind_country_engine` wasn't even declared
as a dependency in `apps/mobile/pubspec.yaml` despite its own doc comment calling it "the
central spine of the Global Enterprise Edition." Migration 0018's `preferred_country`/
`detected_country` columns (fixed to the real `users_profiles` table name in ADR-0022) had no
read or write path anywhere. This phase closes that loop for the first time.

---

## Decision

### 1. Backend — `onboarding/country-service.ts` + `routes/v1/onboarding.ts`

`GET /v1/onboarding/country` returns `{ suggested, countries }`: `suggested` is whatever the
existing server-side 5-step header-based resolution chain (`country/resolution-chain.ts`,
Phase 1) already resolves for the request — no new detection logic, just exposing what already
exists — and `countries` is the full `COUNTRY_REGISTRY` for the picker UI. `POST
/v1/onboarding/country` persists the user's explicit choice to `users_profiles.
preferred_country`, alongside `detected_country` (what was auto-resolved at the time) as an
audit trail. This is the first read/write path either column has ever had.

### 2. Fixed a real, previously-undetected Dart JSON serialization bug

`CountryProfile.fromJson()`/`.toJson()` used `.name`/`.byName()` against `AllergenRegime`/
`NutritionStandard`, which only ever matched Dart's own enum member identifiers (`fssai8`,
`icmrNin`) — never the actual wire values `country/types.ts` sends (`FSSAI_8`, `ICMR_NIN`).
`fromJson()` against a real API response would have thrown immediately (`byName()` raises for an
unmatched name). This was invisible before because the only caller was a self-consistent
SharedPreferences cache round-trip (`country_provider.dart` writing then reading its own
`toJson()` output) — never real server JSON. Building `GET /v1/onboarding/country`'s response
parser is the first code path to actually deserialize a real API response through this model,
which is what surfaced it. Fixed with explicit `Map<Enum, String>` wire-format tables (kept
separate from the enums themselves — call sites using `AllergenRegime.fssai8` etc. as Dart
identifiers throughout `country_registry.dart`/`nutrition_rules` are unaffected).

### 3. Mobile onboarding UI

`CountrySelectionScreen` (new) fetches the suggestion, shows it prominently with a confirm
action, and offers a searchable full-country picker (`CountryPickerList`) as an alternative.
Confirming calls the new POST endpoint, then `CountryProfileNotifier.setOverride()` (existing,
previously also never called by anything), then sets a `country_v2` Drift flag mirroring the
existing `consent_v1`/`disclaimer_v1` pattern. `OnboardingState` gained `hasCountry`; the router
gates entry the same ordered way it already gates consent → disclaimer → (now) country → profile
setup.

`nutrimind_country_engine` is now declared as an `apps/mobile/pubspec.yaml` dependency — it
never was before this phase, for any package. Verifying this surfaced (and, once one more
one-line pubspec addition was made, fixed) the pre-existing `app.dart` `flutter analyze` failures
first found in ADR-0023: `flutter pub get` regenerated the missing `l10n/app_localizations*.dart`
files as a normal side effect, and `nutrimind_localization_engine` — imported by `app.dart` for
`activeLocaleProvider`/`activeTextDirectionProvider` — turned out to have the exact same
undeclared-dependency defect as `nutrimind_country_engine`. Adding it resolved every remaining
issue: **`flutter analyze` is now clean across the entire mobile app**, not just the files this
phase touched directly.

### 4. Presentational widgets kept public and constructor-driven

`CountrySuggestionView`/`CountryPickerList` receive their data via constructor parameters rather
than fetching it themselves, and are public (not `_`-prefixed) specifically so they're testable
in isolation. `ApiClient` (`core/network/api_client.dart`) wraps a private `Dio` instance with no
injection seam, and is depended on by ~17 other screens — swapping it for a testable design was
judged out of proportion to this phase, so the full `CountrySelectionScreen` (the `FutureBuilder`
+ network call) is not directly unit-tested; the presentational widgets it composes are.

---

## Alternatives Considered

### A. Add a DB-lookup step to the server-side resolution chain
Rejected: the server chain is entirely request-header-scoped by design (no per-request DB
round-trip). The loop closes correctly without one: the mobile client fetches `preferred_country`
once via `GET /v1/onboarding/country` at (re)onboarding time, resolves locally, and sends the
result as the `x-user-country` header on every subsequent request — exactly what the Dart
`CountryResolutionChain`'s own doc comment already described as "Step 2: API profile
preferred_country" before anything actually populated it.

### B. Rename the Dart enum members to match the wire format exactly
Rejected: `AllergenRegime.fssai8` etc. are used as compile-time identifiers throughout
`country_registry.dart` and `nutrition_rules`; renaming them to something like
`AllergenRegime.FSSAI_8` would be a large, purely-cosmetic diff across working code for no
behavioral benefit — an explicit wire-format mapping table achieves the same correctness with a
much smaller, more contained change.

### C. Refactor `ApiClient` to accept an injectable `Dio`/`HttpClientAdapter` for full-screen testing
Rejected for this phase: real value, but touches a class ~17 other screens already depend on —
out of proportion to what Phase 10 needs. Tracked as a gap, not fixed here.

---

## Consequences

**Positive:**
- `preferred_country`/`detected_country` (dead since migration 0018) now have a real read/write
  path, and the country resolution engine is invoked from the app for the first time via a real
  onboarding screen.
- A second real cross-language serialization bug is fixed (after ADR-0022's `/api/v1` path bugs)
  before it could ever cause a production crash — no prior code path had exercised
  `CountryProfile.fromJson()` against real server JSON.
- `nutrimind_country_engine` is finally a declared, real dependency of the app it was designed
  for.

**Negative:**
- `CountrySelectionScreen`'s full fetch-and-save flow is not directly integration-tested (only
  its presentational sub-widgets are) — `ApiClient`'s lack of an injection seam is the blocker,
  tracked as a gap rather than fixed here.
- The server-side resolution chain still doesn't read `preferred_country` from the DB directly —
  by design (see Alternatives A), but worth restating: if a user's mobile app is ever bypassed
  (e.g. a future web client, or a support/admin tool), that path would need to independently
  fetch and forward `preferred_country` itself.
- This phase did not audit whether other Dart models with enum-typed fields have the same
  `.name`/`byName()` wire-format mismatch `CountryProfile` had — only this one was found and
  fixed, because it was the one directly load-bearing for this phase's new screen.

---

## Acceptance Gate (Phase 10)

- [x] `GET /v1/onboarding/country` returns the real server-resolved suggestion + full country registry
- [x] `POST /v1/onboarding/country` persists `preferred_country`/`detected_country` to `users_profiles`, rejects unknown ISO codes with 400
- [x] `CountryProfile.toJson()` emits real wire-format strings (`FSSAI_8`, not `fssai8`); `fromJson()` parses them back correctly (new regression tests — the prior round-trip test alone would not have caught this)
- [x] `CountrySelectionScreen` wired into the router's ordered onboarding gate (consent → disclaimer → country → profile)
- [x] `nutrimind_country_engine` declared as an `apps/mobile` dependency; `flutter analyze` clean
- [x] 10 widget tests for `CountrySuggestionView`/`CountryPickerList` (loading/error/confirm/search/selection states)
- [x] Full API suite green (648/648), 0 regressions; `tsc --noEmit` clean; `flutter analyze`/`test` clean on `packages/country_engine` and touched mobile code
- [x] `flutter analyze` clean across the entire `apps/mobile` app (was failing on `app.dart` since before Phase 9; fixed as a side effect of this phase's dependency work)
- [ ] `ApiClient` injection seam for full `CountrySelectionScreen` integration testing (no owner/timeline)
- [ ] Audit of other Dart models for the same enum-wire-format mismatch class of bug (no owner/timeline)

# ADR-0021: GDPR/DPDP Consent Flows & DSR Endpoints (Phase 8)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0014 (CountryProfile DI), ADR-0018/ADR-0019/ADR-0020 (graceful-degradation and
honest-gap deferral pattern this phase reuses for `processing_restrictions` enforcement)

---

## Context

`supabase/migrations/0017_feature_flags.sql` seeded three Phase 8 flags: `global.p8.
gdpr_consent_flow`, `dpdp_consent_flow`, `dsr_endpoints`. The original (pre-rebuild) 19-phase
build already shipped `apps/api/src/routes/v1/data-rights.ts` (export/delete) and
`apps/api/src/health/consent.ts` (per-metric-type sync consent) plus a `user_consents` table
(migration 0002) that was never wired to any code path. Extending these for real, country-aware
GDPR/DPDP support surfaced three pre-existing defects, all fixed here because they are directly
load-bearing for `dsr_endpoints`/`gdpr_consent_flow`/`dpdp_consent_flow` — shipping "regime-aware
consent" on top of a broken erasure endpoint would not be production-ready.

---

## Decision

### 1. Three pre-existing defects found and fixed

**a) `data-rights.ts` was never registered.** `routes/v1/index.ts` only wires 7 of the 16 files
in `routes/v1/` (`health`, `gateway`, `products`, `resolve`, `curation`, `scans`, `flags`).
`data-rights.ts`, `family.ts`, `restaurant.ts`, `planner.ts`, `pantry.ts`, `biomarker.ts`,
`health-data.ts`, and `voice.ts` all exist with real handler code but are unreachable — the
Fastify app never calls `fastify.register()` on them. `data-rights.ts` and the new `privacy.ts`
are now registered (see index.ts). **The other 6 orphaned route files are out of scope for this
phase** (unrelated features spanning Phases 5/9/13/15/16 of the original build) — tracked as a
known gap below, not fixed here.

**b) `data-rights.ts` referenced tables/columns that don't exist.** `USER_TABLES`/`EXPORT_TABLES`
listed `'user_profiles'` and `'scan_history'` — the real tables (migration 0002/0004) are
`users_profiles` (PK `id`, not `user_id`) and `scans`. Both handlers also uniformly filtered
`.eq('user_id', userId)`, which is wrong for `users_profiles` (`id`) and `household_members`
(`owner_id`). Every export/delete call was silently querying the wrong table or matching zero
rows — the route's own documented "gate: deletion proven by verification query" was never
actually true in a real deployment. `USER_DATA_TABLES` is now a single `{table, column}[]` list
(replacing the two independently-drifting `USER_TABLES`/`EXPORT_TABLES` arrays that caused this)
with the correct owning column per table, plus three real user-owned tables that were missing
entirely (`grocery_cart_sessions`, `copilot_conversations`, `recommendations`, and
`weekly_reports`). FK-`ON DELETE CASCADE` children (`scan_images`, `member_safety_evaluations`,
`grocery_cart_items`, `copilot_messages`) don't need separate entries — deleting their parent
row cascades. `user_consents` and `audit_log`/`llm_call_log` are deliberately excluded from
deletion (see §4).

**c) Both handlers read `req.userId`, a property that doesn't exist.** `plugins/auth.ts` sets
`request.user: AuthUser | null` (with `.id`), never `request.userId`. Every call to export/delete
was therefore always returning 401 regardless of authentication. Switched to the
`requireAuth`/`request.user.id` pattern used by every other route (`flags.ts`, and the new
`privacy.ts`).

**d) (Adjacent, found while adding the first Dart test that actually imports it)
`packages/core`'s `result.dart` and `feature_flags.dart` each had an `export` directive placed
*after* class declarations — a Dart compile error ("Directives must appear before any
declarations"). No package's `lib/`/`test/` code had ever actually run `import
'package:nutrimind_core/...'` despite declaring it as a pubspec dependency everywhere
(`country_engine`, `ocr_engine`, `voice_engine`), so this had never been triggered. Fixed by
moving both `export`s (and adding the `import` `result.dart` needed but was implicitly missing)
to the top of each file — this phase's `privacy_regime.dart` test is the first thing in the repo
to compile `nutrimind_core`.

### 2. Privacy regime resolution — `privacy/regime.ts`

`privacyRegimeFor(isoCode)` resolves `'GDPR' | 'DPDP' | 'GENERIC'` using the same 6-country
EU/UK-GDPR set as ADR-0020's `region/registry.ts` (`GB, DE, FR, IT, ES, NL`), plus `IN` for DPDP.
`consentRequirementsFor(regime)` returns structured, per-consent-type requirements (`mandatory`,
`granular`, and a `citation` to the real statute provision — GDPR Art. 6/7/9/13, DPDP Act 2023
Sec. 4/5/6) — both regimes require `health_data` consent to be explicit and granular (GDPR
Art. 9(2)(a) special category; DPDP Sec. 6), distinct from the baseline GENERIC regime where it's
optional. These are structural citations, not generated legal advice — same "single-pass
approximation, licensed review required before enabling for real users" caveat as ADR-0017's
non-India nutrition-standard packs.

### 3. Consent service — `privacy/consent-service.ts` + migration 0021

Wraps `user_consents` (previously dead code — zero call sites anywhere). Migration 0021 adds a
`granted BOOLEAN NOT NULL DEFAULT true` column and widens the unique constraint to `(user_id,
consent_type, version, granted)`, so a withdrawal is a *new* row (`granted: false`), never a
mutation — preserving the table's documented append-only design intent (migration 0002: "never
update existing rows") while satisfying GDPR Art. 7(3)/DPDP Sec. 6(4)'s requirement that
withdrawal be as easy as granting. `getConsentStatus()` resolves the latest event per
`consent_type`. This is distinct from `health/consent.ts`'s `health_consents` table (narrower,
already-enforced per-metric-*sync* consent from the Health Data Platform phase) — `user_consents`
is the broader legal basis for processing at all.

### 4. `user_consents`/`audit_log`/`llm_call_log` excluded from erasure

Deliberate: GDPR Art. 17(3)(b) and equivalent DPDP provisions permit retaining data necessary to
comply with a legal obligation or defend legal claims — a consent/audit history proving *what a
user was told and agreed to* (or an audit trail of privileged actions) is exactly this case.
Deleting it on account erasure would remove the evidence NutriMind would need to demonstrate
prior compliance.

### 5. DSR extensions — rectification and restriction

`PATCH /v1/data-rights/rectify` (Art. 16 / Sec. 12) updates a fixed allowlist of factual
`users_profiles` fields (name, demographics, diet/allergen declarations) — explicitly excludes
engine-computed fields (`tdee_kcal`, `macro_*`) and system state (`onboarding_complete`), since
those aren't "personal data the user asserts is inaccurate."

`POST /v1/data-rights/restrict` (Art. 18 / Sec. 12) is a new, dedicated `processing_restrictions`
table (migration 0022) — deliberately not reusing `user_consents`' `consent_type` column, since a
restriction request is a rights-exercise action, not a purpose-consent grant, and conflating them
would be semantically confusing. **Recording a restriction is real (persisted, queryable,
auditable) but does not itself pause any processing pipeline** — no consumer (score engine,
copilot, analytics) checks this flag yet. The route response says so explicitly
(`note: "...currently pauses no automated processing pipeline end-to-end..."`) rather than
implying an enforcement guarantee that doesn't exist — the same honesty ADR-0020 applied to
`residencySatisfied`.

---

## Alternatives Considered

### A. Silently work around the broken `data-rights.ts` without documenting root cause
Rejected: the whole point of "production-ready, no fabrication" is that a Data Subject Rights
endpoint either actually works or explicitly doesn't — patching around it without naming what
was broken (wrong table names, unregistered route, non-existent auth property) would leave the
next person unable to trust the "✅" in `docs/COMPLIANCE.md`.

### B. Fix all 8 unregistered route files, not just `data-rights.ts`
Rejected for this phase: `family.ts`, `restaurant.ts`, `planner.ts`, `pantry.ts`, `biomarker.ts`,
`health-data.ts`, `voice.ts` are unrelated features spanning several other phases, each with
their own potential internal defects (at least one, `voice.ts`, hardcodes `/api/v1/...` instead
of the `/v1/...` prefix `index.ts` actually applies — a second, related but distinct bug). Fixing
seven unrelated route files in a consent/DSR phase is scope creep; tracked as a known gap.

### C. Model processing restriction as a `user_consents` row with a non-standard `consent_type`
Rejected: `consent_type` is documented (migration 0002) as one of five purpose-consent values;
overloading it with a rights-exercise flag would require every future reader of `user_consents`
to know to special-case it. A small dedicated table is the correct minimal shape.

---

## Consequences

**Positive:**
- `POST /v1/data-rights/export` and `/delete` are now actually reachable, actually query the
  real schema, and actually authenticate — verified end-to-end via `app.inject()` route tests
  (`routes/v1/__tests__/data-rights.test.ts`), not just unit tests of already-broken code.
- `user_consents` (dead since Phase 0) now has a real read/write path and two regimes' worth of
  structured, citable requirements to drive mobile consent-screen copy.
- `nutrimind_core` compiles for the first time — unblocks any future package that actually wants
  to use `Result`/`NutriMindError`/`FeatureFlagService`/`NutriMindFlagKeys` (previously dead
  pubspec dependencies everywhere).

**Negative:**
- `processing_restrictions` has no enforcement consumer yet — recording a restriction changes
  nothing about how the score engine, copilot, or any job pipeline behaves. No owner/timeline.
- The other 6 unregistered route files (`family`, `restaurant`, `planner`, `pantry`, `biomarker`,
  `health-data`) remain unreachable in the running API — a materially larger issue than anything
  fixed in this phase, discovered as a side effect of investigating `data-rights.ts`. No
  owner/timeline; flagged prominently for a dedicated cleanup pass.
- `voice.ts` (also unregistered) hardcodes `/api/v1/voice/parse` instead of the `/v1/...` prefix
  every registered route actually resolves to — will need the same path fix as `data-rights.ts`
  when it's eventually wired in.
- Non-India GDPR/DPDP requirement citations are structural approximations pending licensed
  privacy-counsel review before being relied on for real users — same caveat every prior
  non-India regulatory pack in this project carries.

---

## Acceptance Gate (Phase 8)

- [x] `privacyRegimeFor()` resolves DPDP for IN, GDPR for the 6 EU/UK countries, GENERIC otherwise
- [x] `health_data` consent is `mandatory: true, granular: true` in both GDPR and DPDP regimes
- [x] Consent withdrawal is a new `granted: false` row, never a mutation of the original grant (migration 0021)
- [x] `data-rights.ts` is registered and reachable (`app.inject()` tests, not just unit tests)
- [x] Export/delete query `users_profiles`/`household_members` by their real columns (`id`/`owner_id`), not the non-existent `user_profiles`/`user_id`
- [x] Deletion verification (`remainingRows === 0`) gate still holds against the corrected table list
- [x] Rectification rejects unknown/engine-computed fields (zod `.strict()`)
- [x] Restriction request/lift/status round-trips through `processing_restrictions`, with an honest not-yet-enforced note in the API response
- [x] `nutrimind_core` compiles; `flutter analyze`/`flutter test` clean on `packages/core`
- [x] Full API suite green (567/567), `tsc --noEmit` clean, 0 regressions
- [ ] Enforcement of `processing_restrictions` across score engine / copilot / analytics consumers (no owner/timeline)
- [ ] The other 6 unregistered route files + `voice.ts`'s `/api/v1` prefix mismatch (no owner/timeline — flagged for a dedicated pass)
- [ ] Licensed privacy-counsel review of the GDPR/DPDP structural citations before enabling for real users

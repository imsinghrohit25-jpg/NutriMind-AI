# ADR-0022: Route Registration Audit — 6 Unreachable Route Files (Pre-Phase-9)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0021 (found and fixed the same class of defect in `data-rights.ts` during Phase 8; this ADR completes the audit for the rest of `routes/v1/`)

---

## Context

While extending `data-rights.ts` for Phase 8, we found it was never registered in
`routes/v1/index.ts` — the Fastify app never called `fastify.register()` on it, so none of its
endpoints existed in the running API despite having real, passing unit tests (which only
exercise the handler function in isolation, never through the actual app). That fix flagged six
more route files in the same state: `family.ts`, `restaurant.ts`, `planner.ts`, `pantry.ts`,
`biomarker.ts`, `health-data.ts`, and `voice.ts`. Before starting Phase 9, we audited and fixed
all of them — each spans a different feature area from the original 19-phase build (Family
Nutrition Dashboard, Restaurant Intelligence, Meal Planner, Pantry Intelligence, Biomarker
Platform, Health Data Platform, Voice Platform), so this represents a materially larger
production gap than any single phase's own defects.

Audit method: for each file, cross-reference every `.from('table')`/`.eq('column', ...)` call
against the real schema (`supabase/migrations/0001` through `0022`, read in full — several
migrations use lowercase `create table if not exists` with no `public.` prefix, so a single grep
pattern misses tables; this cost real time in earlier audits and is worth remembering), check the
auth pattern against `plugins/auth.ts`'s actual `request.user: AuthUser | null` shape, and check
the export signature against how `routes/v1/index.ts` actually invokes plugins
(`fastify.register(module, { prefix: '/v1' })`, which calls `module(fastify, opts)`).

---

## Decision

### Universal defect: hardcoded `/api/v1/...` paths

All seven files hardcoded paths like `/api/v1/family/groups`. `routes/v1/index.ts` registers
every file with `{ prefix: '/v1' }`, so a route file's internal paths must be relative
(`/family/groups`) — the prefix supplies the `/v1`. The hardcoded form would have resolved to
`/v1/api/v1/family/groups`, not the real, working `/v1/family/groups`. Fixed in all seven by
stripping `/api/v1` from every route path. (`data-rights.ts` and `privacy.ts` already used the
correct relative-path convention from Phase 8.)

### Universal-ish defect: broken auth

Three variants of the same underlying bug (`request.user`, not `request.userId`, is what
`plugins/auth.ts` actually sets):
- **`restaurant.ts`, `biomarker.ts`, `health-data.ts`, `voice.ts`**: read `req.userId` via a
  self-declared `type AuthedRequest = FastifyRequest & { userId?: string }` — a property that
  never existed. Every handler always 401'd regardless of a valid Supabase JWT.
- **`family.ts`, `planner.ts`, `pantry.ts`**: read the *correct* property (`request.user`) but
  with no null guard (no `requireAuth()` call) — an unauthenticated request (where `auth.ts`
  sets `request.user = null` rather than throwing) threw a `TypeError` dereferencing `.id` on
  `null`, surfacing as an unhandled 500 instead of a clean 401.

All seven now use `requireAuth(request)` (the existing helper, already used by `flags.ts` and
Phase 8's `privacy.ts`/`data-rights.ts`) followed by `request.user.id`.

### Structural defect: registration-incompatible export signatures

Three files could not have been registered via the standard `fastify.register(module, { prefix })`
pattern even with the path/auth bugs fixed, because Fastify invokes a plugin as `(instance,
opts)`:
- **`biomarker.ts`**: `export async function registerBiomarkerRoutes(fastify, supabase, gateway)`
  — a 3-arg signature. `supabase` would have received `{ prefix: '/v1' }` (the register options
  object), and `gateway` would have received Fastify's internal `done` callback. Every
  `supabase.from(...)` call would throw `supabase.from is not a function` on first request.
- **`health-data.ts`**: `export async function registerHealthDataRoutes(fastify, supabase)` — same
  class of bug, 2-arg.
- **`voice.ts`**: `export async function registerVoiceRoutes(fastify, gateway)` — same class,
  2-arg.
- **`restaurant.ts`**: `export async function registerRestaurantRoutes(fastify, supabase, gateway)`
  — same class, 3-arg.

All four converted to `export default async function xRoutes(fastify: FastifyInstance)`, sourcing
`supabase`/`gateway` from `fastify.supabase`/`fastify.gateway` (the real decorations `app.ts`
provides) — matching every other route file in the directory. `family.ts`, `planner.ts`,
`pantry.ts` already used a single-`fastify`-arg signature but with a *named* (not default) export
and `(fastify as any).supabase` casts instead of the properly-typed decoration; normalized to
default exports with typed access for consistency.

### Schema defects (2 files)

**`restaurant.ts`**: queried `.from('user_profiles').select('dietary_preference,
allergen_profile').eq('user_id', userId)`. None of `user_profiles` (real table: `users_profiles`,
migration 0002), `dietary_preference`/`allergen_profile` (real columns: `diet_type`/`allergens`),
or a `user_id` column on that table (its PK **is** the user id — `id`) exist. Fixed both handlers
(`menu/scan`, `recipe/generate`) to query `users_profiles.id`/`diet_type`/`allergens`.

**`family.ts`** (and its service, `family-service.ts`):
- Dashboard route queried a `food_logs` table that has never existed anywhere in the schema —
  the real table is `meal_logs` (migration 0006). Also used `.eq('logged_at::date', date)`, an
  inline SQL cast PostgREST's `.eq()` does not support. Fixed to query `meal_logs` with the real
  nutrition columns (`energy_kcal`, `protein_g`, `fat_total_g`, `carbohydrates_g`) and a
  `.gte()/.lt()` UTC day-range filter instead of the invalid cast.
- `family-service.ts`'s `validateFamilyMealPlan()` had the same `user_profiles`/`user_id` bug as
  `restaurant.ts`, plus checked `dietTypes.has('non-vegetarian')` (hyphen) against
  `users_profiles.diet_type`'s real CHECK-constraint value `'non_vegetarian'` (underscore) — the
  mixed-diet-type warning could never actually fire. Fixed both.
- The member-removal handler duplicated (with a redundant double `.eq('group_id', ...)`) logic
  already correctly implemented in `family-service.ts`'s `removeFamilyMember()` (which also
  enforces "owner cannot remove themselves," which the route's inline version didn't). Route now
  delegates to it instead of re-implementing.

**Also found and fixed while auditing `family.ts`**: migration `0018_country_preferences.sql`
(`ALTER TABLE user_profiles ADD COLUMN preferred_country...`) targets the same non-existent
`user_profiles` table — this migration would fail outright (`relation "user_profiles" does not
exist`) against any real database. Fixed to `users_profiles` in both the migration and its
rollback. (`preferred_country`/`detected_country` are not yet read by
`country/resolution-chain.ts` — wiring them in is separate future work.)

### Minor defects fixed in passing

- `pantry/receipt-ocr.ts`: the `pantry_items` batch insert inside `parseAndSavePantryItems()`
  didn't check `{ error }` — a failed insert (e.g. a constraint violation from a malformed
  OCR-parsed item) was silently swallowed and the route still reported success. Now throws.
- `biomarker.ts`, `health-data.ts`: `parseInt(query.limit ?? '100', 10)` (and similar) had no
  `NaN` guard — a non-numeric query param would pass `NaN` straight into `.limit()`/math.
  Wrapped with `Number.isFinite()` fallbacks.
- `planner.ts`: the grocery-item-toggle `UPDATE` didn't repeat the `user_id` ownership filter the
  preceding `SELECT` used (not exploitable given UUID params and the preceding 404 check, but a
  defense-in-depth gap relative to every other mutating call in the file). Added.
- `voice.ts`: dropped an unused `buildScoreResponse` import.

### Deliberately not changed

`restaurant/menu-scanner.ts` and `restaurant/recipe-generator.ts`, `planner/meal-plan-generator.ts`
and `planner/grocery-optimizer.ts`, `biomarker/{dexcom,flag-engine,lab-ocr-parser}.ts`,
`health/{dedup,energy-adjustment,providers/*}.ts`, and `voice/{nlu,tts}.ts` — every service module
these seven routes call — were read in full during the audit and found schema-correct and
logically sound. No changes were needed there; the defects were entirely in the route layer
(paths, auth, export signatures) plus the two schema mismatches named above.

---

## Alternatives Considered

### A. Fix only the minimum needed to register each file (paths + signatures), leave auth/schema bugs
Rejected: registering a route that still 401s on every valid request, or silently queries the
wrong table, is not "production-ready" — it would trade an honest 404 (route doesn't exist) for
a confusing 401/500 (route exists but is broken), which is worse for debugging, not better.

### B. Rewrite `docs/API.md` to match the corrected paths while here
Rejected: `docs/API.md` documents an `/api/v1/...` base URL and route shapes (e.g. `GET
/scan/:barcode`) that don't match *any* currently-implemented route, registered or not — it
appears to predate significant refactoring across multiple phases and needs a full audit against
the real API surface, not a patch for the seven files this ADR touches. Tracked as a known gap.

---

## Consequences

**Positive:**
- Seven previously-inert route files (spanning Family, Restaurant, Planner, Pantry, Biomarker,
  Health Data, and Voice) are now real, registered, reachable, and tested against the actual
  schema — 625/625 tests pass, including a new full-route-tree integration test
  (`routes/v1/__tests__/index.test.ts`) that registers every file in `routes/v1/` together and
  proves the app boots without a plugin-signature crash, every route resolves to its real path,
  and auth/gateway-unavailable error paths return clean status codes.
- The `data-rights.ts`-class defect (unregistered + broken table refs + broken auth) is now
  understood to be a *pattern*, not a one-off — worth checking for in any future "wire up an
  existing-but-dormant route file" task.

**Negative:**
- `docs/API.md` remains stale/aspirational relative to the real API surface — not just for these
  seven files. No owner/timeline for a full rewrite.
- `preferred_country`/`detected_country` (migration 0018, fixed table name but still unused) are
  not wired into `country/resolution-chain.ts` — the migration is now valid but the feature it
  was meant to support is still not implemented.
- This audit covered `routes/v1/` only. Other parts of the codebase could have the same
  never-actually-run-against-a-real-database class of defect; no exhaustive sweep beyond this
  directory was performed.

---

## Acceptance Gate

- [x] All 16 files in `routes/v1/` are registered in `routes/v1/index.ts`
- [x] `routes/v1/__tests__/index.test.ts`: `registerV1Routes()` + `app.ready()` succeeds with real decorations wired (proves every export signature is register()-compatible)
- [x] Every fixed route resolves at its real `/v1/...` path (not 404, not `/api/v1/...`)
- [x] Every auth-required route returns 401 (not 500) when unauthenticated
- [x] `restaurant.ts`/`family-service.ts` query `users_profiles.id`/`diet_type`/`allergens` (not `user_profiles`/`user_id`/`dietary_preference`/`allergen_profile`)
- [x] `family.ts`'s dashboard queries `meal_logs` with a valid date-range filter (not the non-existent `food_logs` / an invalid `::date` cast)
- [x] Migration `0018_country_preferences.sql` targets `users_profiles` (would no longer fail against a real database)
- [x] 625/625 API tests pass (63 files), 0 regressions; `tsc --noEmit` clean
- [ ] `docs/API.md` full rewrite against the real, registered API surface (no owner/timeline)

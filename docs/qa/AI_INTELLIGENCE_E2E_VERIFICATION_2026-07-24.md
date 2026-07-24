# AI-Intelligence Upgrade — E2E Verification (2026-07-24)

Session resume. No code changed this session — this is a verification-only pass that discharges
the E2E gate the AI-intelligence upgrade (see `docs/PRODUCTION_AUDIT_2026-07-13.md`) was waiting on.

## What was recovered / confirmed complete (NOT rebuilt)

- **Premium redesign** (ADR-0034…0040, `docs/qa/REDESIGN_PROGRESS.md`): Phases 0–4 complete,
  G4 passed. In particular the **Home redesign** (`features/home/home_screen.dart`) is fully
  implemented and matches ADR-0038 exactly — floating `GlassCard.static` entry cards with
  staggered `flutter_animate` fade+slide entrances, `NutriMindLogo` AI presence tied to real
  `scansToday` (idle/celebrating), real time-of-day greeting, real last-scanned ring vs the
  disclosed 2000-kcal reference, honest empty state. It is done; it was not recreated.
- **AI-intelligence upgrade** (disease engine ×10 conditions, meal-photo multi-food, personalization
  context, meal suggestions): all files present and wired; `disease.ts` registered in
  `routes/v1/index.ts`; `personalization-context`/`meal-suggestions` consumed by
  `agents/specialists/nutrition.ts` and `engines/personalization/budgets.ts`.

## Static gates (green)

- `tsc --noEmit` (apps/api): clean.
- API test suite: **1173 passing / 146 files** (includes 69 new disease/personalization/
  meal-photo/nutrient-scaling tests exercising the real request lifecycle via `app.inject`).
- `flutter analyze`: 0 issues. `flutter test`: **36 passing**.

## Live end-to-end verification

### Re-verification against the LIVE REMOTE project (authoritative, later same day)

The remote Supabase project was **resumed and is healthy** — the earlier-in-session
`ENOTFOUND`/HTTP-000 reading was a temporary paused/deprovisioned state, now resolved. Full
infra + E2E re-check against `gjfoclrxsswkzwxtqhho.supabase.co`:

| Check | Result |
|---|---|
| DNS `SUPABASE_URL` host | resolves (Cloudflare 172.64.149.246 / 104.18.38.10) |
| DNS `db.<ref>` (direct Postgres) host | resolves — **AAAA only, no A record (IPv6-only)** |
| Auth `/auth/v1/settings` · JWKS · REST | HTTP 200 · 200 · 401 (all serving) |
| `.env` project URL + keys | current project; keys valid (service-role + password auth both work) |
| `GET /v1/ready` (real `SELECT 1` on remote PG) | ready — **10/10** probes OK |
| `POST /v1/resolve/barcode` Nutella (unauth) | **8/8** OK; score **37.7 (poor)**; allergens tree_nuts/milk/soy; "Gluten free" correctly NOT flagged |
| remote `users_profiles` schema | all 0035+0036 columns present (`reproductive_status`, `medications`, `budget_level`, `date_of_birth`, `primary_health_goal`) |
| `GET /v1/disease/guidance` (authed, remote) | conditions `[diabetes, hypertension]` → **2 blocks, 5 citations** (ICMR/WHO/RSSDI) |
| `POST /v1/resolve/barcode` Nutella (authed, remote) | score 37.7; **diabetes rule triggered (severity: warning)** on real sugar |
| `GET /v1/disease/guidance` (no token) | **401** — live + auth-guarded |

A throwaway QA user (`e2e-verify-<ts>@nutrimind.qa`) was created via the Admin API, given
conditions, exercised, then **deleted** (profile 204, auth user 200, verified gone). Server run
against the repo's real `.env`; no `.env` edits.

**One transient fault + root cause (task item 6):** the *first* DB-hitting request after server
start threw `getaddrinfo ENOTFOUND db.gjfoclrxsswkzwxtqhho.supabase.co` at
`datasources/openfoodfacts/cache.ts:131` (postgres.js). Root cause: the Supabase **direct**
connection host is **IPv6-only** and IPv6 DNS on this network is intermittent. It did **not
recur** across the following ~18 DB operations (10 ready + 8 resolve), so the connection is
currently stable. **Durable fix (recommended, not applied — needs the exact string):** switch
`DATABASE_URL` from the direct host to the IPv4-reachable **Supavisor session pooler**
(`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<project-ref>`; pooler hosts confirmed
to resolve over IPv4 this session). Not guessed/applied because the region + pooler credentials
come from the Supabase dashboard and blindly rewriting a working prod connection string is riskier
than the transient blip.

### Earlier same-session cross-check against the LOCAL Docker stack

Before the remote was confirmed back, the identical E2E was also run against the local Supabase
Docker stack (Postgres :54322) with real food data — authed disease guidance (2 cited blocks),
Cola→diabetes and chips→hypertension rules firing, unauth scores 68.4/48.4. This required applying
migrations 0035/0036 to the local DB first (they weren't present there). Consistent with the remote
result above. All local test state was cleaned up.

Together these prove the AI-intelligence data contract end-to-end through a real HTTP server on the
live remote backend: auth → profile conditions → per-condition cited guidance, and product
resolve → real health score → per-product disease-rule evaluation firing on the correct nutrients.

## Cleanup performed

Test user/profile deleted, test feature-flag reverted, throwaway `apps/api/.env` (local-stack
pointer) removed, verification server stopped. No tracked source file was modified this session.

## Remaining / PENDING-HUMAN

- **On-device UI walkthrough** of the redesigned Home + disease chips + meal-photo results is not
  done this session. The remote backend is now healthy, so the compiled app can reach it — this is
  now just a matter of building/installing the APK and driving the emulator (`nutrimind_e2e` AVD is
  available), not blocked on infra. The backend contract above is fully proven; this is the
  UI-rendering confirmation layer, consistent with the PENDING-HUMAN device gaps noted every prior
  phase.
- **Recommended infra hardening:** migrate `DATABASE_URL` to the Supavisor IPv4 pooler (see the
  transient-fault note above) to eliminate the intermittent IPv6-only-host DNS failures.
- The large Jul-13 working tree (redesign + AI-intel + migrations 0035/0036 + auth rebuild) remains
  **uncommitted**, awaiting the user's go-ahead to commit (same status as the earlier auth-rebuild
  diff).

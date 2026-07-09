# ADR-0026: Enterprise Scale & Reliability (Phase 12)

**Status:** Accepted
**Date:** 2026-07-09
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0025 (AI Memory System, Phase 11 — this phase's job-stub follow-up and the
K8s-CronJob-vs-pg-boss decision it deferred here), ADR-0020 (Multi-Region Routing & Edge Caching,
Phase 7 — the region registry this phase's Helm values/Cloudflare Worker key off of), ADR-0006
(gateway/routing, extended by this phase's model-tier/semantic-cache/backpressure additions)

---

## Context

The master prompt addendum's §13 (Enterprise Scale & Reliability) asks for K8s topology, AI
gateway tiering/cost governance, zero-downtime deploy tooling, and reliability engineering
(SLOs, degradation ladder, chaos/load testing, capacity model) — explicitly as *design ceilings
proven at scaled-down ratios*, not production claims (§13.1's own honesty rule). This ADR
documents what was built, what was verified with real tools against real (if small-scale)
infrastructure, and — following this build's established pattern — several significant
pre-existing defects found while doing the work a real deployment of this phase's own subject
matter required.

---

## Decision

### 1. K8s scope boundary — managed services never move to Kubernetes

Per the addendum's own compute topology table (§13.2): Supabase (Postgres/Auth/Storage/RLS),
Cloudflare Workers/KV/CDN, and Supabase Edge Functions stay exactly where they are. Kubernetes
(`infra/helm/nutrimind/`) hosts *only* the stateless/batch compute that needs horizontal
autoscaling: the API server (incl. AI gateway routes, since this build has never split the
gateway into its own microservice — see §5 below), the pg-boss worker, and CronJobs that trigger
fanout jobs on a schedule. This chart was validated with real tools, not just written: `helm
lint` (0 failures), `helm template` rendering 15-16 real Kubernetes objects across three values
files (`values-ap-south-1.yaml`, `values-eu-west-1.yaml`, `values-us-east-1.yaml`), and
`kubeconform` schema-validating every rendered object against the real Kubernetes OpenAPI spec (0
invalid). No cluster exists anywhere to `helm install` into (see `docs/scale/limits.md`).

### 2. Queue technology — pg-boss stays; pgmq/NATS/Redpanda deferred with a real trigger metric

The addendum names Postgres-based queueing (pgmq) "initially," with a later migration to
NATS/Redpanda "when throughput demands." This build already has pg-boss (in production use since
Phase 0 for weekly reports/embeddings, and since Phase 11 for memory aggregation) — a real,
working Postgres-backed queue, functionally equivalent to what pgmq would provide. Introducing a
second, different Postgres-queue library (pgmq) alongside an already-working one would be pure
churn with no capability gain. **Trigger metric for migrating off pg-boss to NATS/Redpanda:**
sustained pg-boss queue depth (`pgboss.job` row count in the `created`/`retry` states) exceeding
10,000 for more than 15 minutes, OR p95 job-pickup latency exceeding 30 seconds — either signal
indicates pg-boss's polling-based dispatch (not a real message bus) has become the bottleneck.
Not measured yet (no real traffic); this is the number to watch for, not a current alarm.

### 3. Job-stub wiring (this phase's ADR-0025 follow-up)

`weekly-report`, `embed-product`, `embed-knowledge-chunk`, `embed-user-history` were four
pre-existing pg-boss job registrations whose handlers were literal `console.log` stubs — found in
Phase 11, explicitly deferred to Phase 12 there. All four are now wired to real logic
(`jobs/registry.ts`). `fitbit-sync`/`garmin-sync` (real logic since Phase 13/§R of the original
build, per `ADDENDUM_DELIVERY_REPORT.md`) were found to never have been registered as pg-boss
workers at all — not even reachable as stubs — and are now registered with a real fan-out
(`jobs/handlers/health-sync-fanout.ts`).

Wiring `weekly-report` for real surfaced two further pre-existing defects in
`jobs/handlers/weekly-report.ts` itself (the exact "load-bearing wall of the room being
renovated" case this build's established discipline treats as in-scope to fix, not just
document): it queried a table (`user_profiles`) and column (`daily_budget`) that have never
existed (real table: `users_profiles`; no stored budget column — TDEE/macros are engine outputs,
recomputed via `computeEnergyTarget`/`computeDailyBudget`, same as any other real caller would),
and it cast raw `meal_logs` rows directly to the aggregator's `MealEntry` shape without mapping
fields at all (wrong casing, missing the required nested `nutrition` object — would have thrown
`TypeError` on first real invocation). A third, subtler defect: `users_profiles.activity_level`'s
five real DB values (`sedentary/lightly_active/moderately_active/very_active/extra_active`) are
offset by one name from `engines/personalization/targets.ts`'s `ActivityLevel` type
(`sedentary/light/moderate/active/very_active`) — the DB's `very_active` is the engine's
`active`, and the DB's top tier `extra_active` is the engine's `very_active`. Fixed with an
explicit wire-format mapping table, the same bug class (and the same fix pattern) as
`CountryProfile`'s enum mismatch (ADR-0024) and `ai_personalization`'s consent-type mapping
(ADR-0025) — this build's third occurrence of "a bare `.name`/cast between two independently-named
enums silently breaks," now with three independent instances all fixed the same documented way.

12 new tests (`jobs/handlers/__tests__/weekly-report.test.ts`,
`memory/__tests__/history-item-embedder.test.ts`,
`knowledge/ingest/__tests__/embedder.test.ts`) cover the real handler logic, not just that the
stub was replaced.

### 4. `llm_call_log` — a second silently-broken table, found the same way as Phase 11's `feature_flags`

While building cost-governance (§6 below), `gateway/cost-log.ts`'s `INSERT` was found to target
columns (`success`, `error_code`, `called_at`, and a `cached` column that never existed at all)
that don't match the real schema (migration 0009: `status`, `error_message`, `created_at`; no
`cached` column). Every real call has silently failed since this file was written, caught by its
own `try/catch` and only logged to console — meaning `llm_call_log` has been empty in any real
deployment for this table's entire existence, exactly like Phase 11's `feature_flags` defect.
Fixed: `cost-log.ts` now writes the real columns; migration 0025 adds the genuinely-new `cached`
column (needed for the addendum's own "cache hit ≥ 90%" gate) as a plain additive `ALTER TABLE ...
ADD COLUMN`. Also fixed in the same pass: a cache HIT was re-logging the ORIGINAL call's
`cost_usd` on every hit (double/N-times-counting spend that was never actually re-incurred) —
`CostLogger.logFromLLMResponse` now zeroes `cost_usd` whenever `response.cached` is true.
Verified for real: all 26 migrations (0001–0026) applied in sequence against a fresh throwaway
database in the real local Supabase Postgres instance (the same technique Phase 11 established),
the exact `cost-log.ts` INSERT shape was executed against the live schema and succeeded, and both
new rollback migrations (0025, 0026) were also applied and verified to fully undo their changes.

### 5. AI gateway stays one process; tiering/cache/backpressure/cost-governance are additive layers within it

The addendum's compute topology names "AI Gateway service" as its own K8s workload. This build's
gateway (`gateway/router.ts`) has always lived inside the single Fastify API process, mounted at
`/v1/gateway/*` — splitting it into a separate microservice is a real architectural change
(new service boundary, new auth/routing surface) out of scope for an infra-and-reliability phase;
the Helm chart's `api` Deployment satisfies the K8s-hosting requirement pragmatically since that's
where the gateway routes actually run. Added, all additive/optional (existing callers unaffected
if unused): `gateway/model-tier.ts` (T0 deterministic templates / T1 fast-model / T2 frontier,
selected only from explicit `intentTag`/`complexityHint` fields — never inferred from message
content, matching this build's "derived, never divined" discipline from §12.1), `gateway/
semantic-cache.ts` (embedding-similarity cache, scoped strictly to `cacheScope: 'global'`
requests — personalization-bearing responses are never shared cross-user), `gateway/
backpressure.ts` (per-user token bucket + global concurrency cap, `GatewayOverloadedError` on
overflow rather than an unbounded queue), and `gateway/cost-governance.ts` (hourly budget check
job flipping a new `global.p12.ai_cost_kill_switch` feature flag, which forces T2→T1 routing
globally when engaged). 23 new tests across `gateway/__tests__/{router,model-tier,backpressure,
cost-governance}.test.ts`.

**Known, documented limitation:** the semantic cache is in-process (a `Map`, like the existing
exact-match `GatewayCache`) — not shared across horizontally-scaled replicas. A real multi-pod
deployment would need this backed by a shared store (Redis, or a KV-like service); not built here,
tracked in `gateway/semantic-cache.ts`'s own comments and `docs/scale/limits.md`.

### 6. Zero-downtime tooling — a real, verified destructive-DDL guard; a real, verified canary script

`scripts/lint-migrations.ts` rejects DROP TABLE/COLUMN, RENAME, TRUNCATE, a column type change,
or a NOT-NULL constraint with no safe backfill, in any migration file *added* since a given git
ref — run for real against this repo's actual history: correctly flagged the two known
pre-Phase-12 destructive migrations (0017's `DROP TABLE`, 0020's `RENAME COLUMN` — both
pre-launch, zero-production-data exceptions already documented in their own migrations) under
`--all`, and correctly passed migrations 0025/0026 under `--since HEAD`. 12 unit tests. Wired into
CI (`migrations-lint` job, `.github/workflows/ci.yml`) diffing against the PR base SHA.
`scripts/cd/deploy-canary.sh` implements a replica-ratio canary (5%→25%→100%, no service mesh in
this environment to do real percentage-based traffic splitting — approximated via
canary-replica-count / total-replica-count against the same Service selector) with an
auto-rollback trigger on an OPEN circuit breaker read directly from the canary pod (bypassing the
shared Service so a canary-specific regression can't hide behind the larger stable pool). Verified
for real with stubbed `helm`/`kubectl`/`sleep`: all four scenarios (healthy 5%, unhealthy 25%
triggering `helm rollback`, 100% promotion, missing-args error) behave exactly as designed. Wired
into `.github/workflows/cd.yml`'s new `backend` job (builds+pushes real Docker images to GHCR —
would work today — then runs the canary script, skipping gracefully with a clear warning when no
`KUBE_CONFIG_AP_SOUTH_1` secret exists, which is the case in this environment).

### 7. Dockerfile — found and fixed three real defects while getting the images to actually run

`apps/api/Dockerfile` (new) builds both `api` and `worker` runtime images from one multi-stage
build. Building and *running* these images (not just building them) surfaced three real,
previously-undetected defects, none related to anything this phase wrote:

1. **`apps/api`'s compiled output path was never what `package.json`'s own `start`/`start:worker`
   scripts assumed.** `tsconfig.json`'s `include` pulls in `packages/shared/src/**/*` directly
   (so the two workspaces type-check against each other's real source), which makes TypeScript
   infer `rootDir` as the monorepo root rather than `apps/api` — real output lands at
   `dist/apps/api/src/server.js`, not `dist/server.js`. `npm run build && npm start` has never
   worked in this repo; only `tsx watch src/server.ts` (which ignores `outDir` entirely) has ever
   been exercised. Fixed in `package.json` and the Dockerfile/Helm `args`.
2. **`@supabase/supabase-js` was never a declared dependency of `apps/api`**, despite being
   imported throughout (`plugins/supabase.ts`, nearly every route file, `jobs/registry.ts`) —
   only `supabase/tests/package.json` declared it. It "worked" in whole-repo installs purely
   because npm workspace hoisting put it in the shared root `node_modules`, silently masking a
   real missing dependency for this entire build track — until a container build installs
   `apps/api`'s dependencies in isolation, which surfaced it immediately (`ERR_MODULE_NOT_FOUND`).
   Fixed by adding the same version range apps/api/package.json.
3. **Node 20 cannot run this API at all.** `@supabase/supabase-js@2.110.1`'s `realtime-js`
   dependency throws "native WebSocket not found" inside `SupabaseClient`'s constructor —
   unconditionally, on every `createClient()` call, not just when realtime features are used —
   which crashes `plugins/supabase.ts` on Node < 22. `npm ci`'s own "Unsupported engine" warnings
   had already flagged this for several `@supabase/*` packages; nothing had ever turned it into a
   hard failure before an image was actually run. This build's own CI (`ci.yml`) already used
   Node 22 throughout — only the Dockerfile (new) and the root `package.json`'s `engines` field
   (`>=20.0.0`, now `>=22.0.0`) were out of sync with that reality.

Both images were built (`docker build`) AND run (`docker run`) for real: the `api` image served a
real `GET /v1/health` 200 response and passed its own `HEALTHCHECK`; the `worker` image started
pg-boss and reached (and correctly failed against, given no real DB in that specific throwaway
run) a real Postgres connection attempt — proving the process boots correctly up to the point
where actual infrastructure is needed. A `.dockerignore` was added (none existed) after noticing
the build context had no exclusions at all.

### 8. Reliability — a real liveness/readiness split, a real degradation ladder, one real chaos drill

`GET /v1/ready` (new) checks Postgres reachability with a 2s timeout — distinct from the existing
`GET /v1/health` (process-alive only), because a database blip should pull a pod out of a
Service's load-balancing rotation (readiness), not restart the process (liveness), which fixes
nothing when the database, not the process, is the problem. `reliability/degradation.ts`
(`computeDegradationLevel`) classifies `full`/`ai_degraded`/`reference_only` from real signals
(DB reachability, AI circuit-breaker state) — exposed at `GET /v1/system/degradation`. The Health
Score Engine and Allergen Hard Gates are deliberately absent from this ladder: they're pure
functions with no I/O or LLM dependency (contract-tested since Phase 11,
`memory/__tests__/safety-boundary.test.ts`), so there is no signal that could make them degrade.

**One real chaos drill was executed** (`docs/scale/failover-drill-2026-07-09.md`): the real local
Supabase Postgres container was stopped while the API process (pointed at it) was live.
`/v1/health` correctly stayed up throughout; `/v1/ready` correctly returned 503 with the real
`ECONNREFUSED` error within 1 second; `/v1/system/degradation` correctly reported
`reference_only`. Recovery (container restart → `/v1/ready` back to 200) took 2 seconds. A
material correction was made mid-drill: this repo's real `.env` points `DATABASE_URL`/
`SUPABASE_URL` at a remote hosted Supabase project, not the local Docker stack — the first
attempt at this drill (stopping the local container) had zero effect on the running server for
exactly that reason. A throwaway, gitignored `.env` override pointed at the real local stack
instead; nothing about the real remote project was touched.

SLOs (`docs/slo/core-paths.md`) target 99.9% monthly availability (deliberately below the
addendum's 99.99% design ceiling, since nothing near that has ever been measured) with a
two-tier multi-window burn-rate alert (`observability/alerting/slo-burn-rate.rules.yml`),
validated with real `promtool check rules`/`check config` and loaded into an actually-running
Prometheus container (confirmed `"health":"ok"` on every rule via the live `/api/v1/rules`
endpoint) — which also surfaced a fourth real defect: `observability/docker-compose.yml` mounted
`prometheus.yml` but never the `alerting/` directory it references, so the new `rule_files` entry
would have 404'd on container start; fixed in the same commit. **Known, documented limitation:**
the only metric this API actually exports (`http_server_duration`, confirmed by starting the
server and scraping `:9464/metrics` directly) has no route/path label, so these SLO rules are
necessarily aggregate-API-wide, not genuinely per-core-path — closing that gap needs an
`http.route` attribute added to the OTEL Fastify instrumentation, not done this phase.

### 9. Load testing — two broken k6 scripts fixed; a major undocumented gap found in the process

Both existing k6 scripts, when actually run for the first time this phase, immediately failed:
`scan-load.js` targeted `GET /api/v1/scan/:barcode` (never a real endpoint — fixed to the real
`POST /v1/resolve/barcode`) and `copilot-load.js` targeted `POST /api/v1/copilot/chat`. **The
latter has never existed in this build track.** `apps/api/src/copilot/{orchestrator,guardrails,
streaming,grounding-verifier,memory}.ts` is real, substantial code (conversational orchestration,
input guardrails, SSE streaming helpers, RAG grounding verification) but is wired to no route
anywhere in `routes/v1/` — confirmed by grepping every route file. This is a significant,
previously-undocumented finding on the same scale as Phase 8's "6 unregistered route files," except
here there is no route file to register at all; wiring a full SSE-streaming conversational
endpoint is a separate feature-completion effort, explicitly out of scope for an infra/reliability
phase, and is **not fixed here** — flagged prominently instead (this ADR, the Phase 12 summary,
and `docs/scale/loadtests/2026-07-09-smoke-verification.md`). `copilot-load.js` was rewritten to
target the real, reachable `POST /v1/gateway/complete`, relabeled around this phase's new T0/T1/T2
tiers. Both scripts were smoke-run (trivial VU counts, real server, real local Postgres) to prove
the fixes are real, not just plausible-looking diffs — see the smoke-verification doc for exact
results and their honest limits (no sustained-load run at the addendum's target VU counts has been
performed).

### 10. Memory decay policy and wake-word/commercial-SDK decisions — carried forward unchanged

No new decision needed: Phase 11's half-life fact-decay policy (`memory/aggregation/*.ts`'s
per-fact-type `valid_until` TTLs, ADR-0025 §2) and Phase 6's wake-word/commercial-SDK gap
(`voice/wake-word.ts` — no bundled keyword model for any locale, honestly reports unavailable,
ADR-0019) are both unaffected by this phase's infra work and remain exactly as previously decided.

---

## Consequences

- Four more real, previously-silent defects found this phase (job-handler table/column/shape
  mismatches, `llm_call_log`'s wrong columns, the Dockerfile-path/dependency/Node-version trio,
  the missing `alerting/` volume mount) — each found by actually running the exact thing this
  phase needed to run for real, not by code review alone. This build's running total of
  "silently broken since before this rebuild started, found by actually executing it" defects is
  now substantial across nearly every phase; the local real-Postgres-instance verification
  technique (Phase 11) and the "build it, then actually run/build/deploy it" discipline (this
  phase) both keep paying for themselves.
- One significant NEW-KIND finding: an entire feature's HTTP surface (`copilot/`) that exists as
  real code but was never wired to any route — distinct from "wrong path" bugs, this is "no path
  at all." Flagged for a dedicated future pass, not fixed here.
- Every infrastructure artifact that can be verified without a live cloud account (Helm chart
  schema validity, Docker image build+run, canary script control flow, migration linter
  behavior, Prometheus rule syntax and live-load health, k6 script correctness against real
  endpoints) was verified with a real tool, not asserted from documentation. What remains
  unverified is exactly and only what requires infrastructure this environment doesn't have — see
  `docs/scale/limits.md` for the complete accounting.

## Follow-ups (tracked, not blocking)

- Wire `copilot/orchestrator.ts` to a real `/v1/copilot/*` route (SSE streaming) — a
  feature-completion effort, not infra.
- Add an `http.route` attribute to OTEL Fastify instrumentation so SLO/burn-rate rules can be
  genuinely per-core-path instead of aggregate.
- Back the semantic cache (`gateway/semantic-cache.ts`) with a shared store (Redis or similar) for
  correctness under horizontal scale-out.
- Add Alertmanager (or equivalent) to `observability/docker-compose.yml` so firing SLO alerts
  reach a human, not just Prometheus's own UI.
- Provision a real K8s cluster and a real Cloudflare account to close the "designed vs. deployed"
  gap this ADR documents throughout.

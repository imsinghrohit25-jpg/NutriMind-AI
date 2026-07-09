# Scale Limits — Tested vs. Designed (Phase 12, §13.1)

> "these are design ceilings proven by load tests at scaled-down ratios... not marketing claims.
> Document tested-vs-designed limits in `/docs/scale/limits.md`" — addendum §13.1.

This is the single accounting of what's real (built, running, verified against actual
infrastructure) vs. designed (written, valid, would work, never deployed/exercised at scale) for
every Phase 12 deliverable. Cross-reference: `docs/scale/capacity-model.md` (the QPS/cost math),
`docs/scale/failover-drill-2026-07-09.md` (the one real chaos drill),
`docs/scale/loadtests/2026-07-09-smoke-verification.md` (k6 script smoke checks).

| Dimension | Addendum design ceiling | What's actually tested | Gap |
|---|---|---|---|
| Registered users | 100M | 0 (no production users; local dev/test only) | Entire gap — no real traffic ever |
| Food records | 1B rows | Whatever's in the local Postgres test DB (thousands, from seed/test fixtures) | Entire gap |
| Barcode scans | 500M cumulative, high burst QPS | A 2-VU/4-iteration k6 smoke run (this phase) confirming the request/response shape is correct; p95 806ms observed at that trivial scale (not a real burst) | No sustained-load run has ever happened |
| AI conversations | 10M/day | A 1-VU/2-iteration k6 smoke run that got 401 (no real JWT/LLM key configured for the check) | No successful AI-gateway load run has ever happened |
| Availability | 99.99% design ceiling | This doc's own SLO target is deliberately set lower (99.9%, `docs/slo/core-paths.md`) precisely because 99.99% has never been measured against anything | See `core-paths.md`'s own explanation |
| Zero-downtime deploys | Canary + auto-rollback | `scripts/cd/deploy-canary.sh`'s control flow verified with stubbed `helm`/`kubectl` (proves the bash logic, math, and rollback trigger are correct) — never run against a real cluster | No real cluster exists anywhere to deploy to |
| K8s topology | Multi-region clusters, HPA, PDB, NetworkPolicy | Helm chart validated with real tools: `helm lint` (0 failures), `helm template` rendering 15-16 real K8s objects, `kubeconform` schema-validating every rendered object against the real Kubernetes OpenAPI spec (0 invalid), and the API/worker Docker images actually built and run locally (`docker run`, real HTTP responses, real health/readiness behavior) | No cluster exists to `helm install` into — everything above the container level is unexercised |
| Edge caching (Cloudflare) | Worker + KV, ≥90% hit rate | `infra/cloudflare/barcode-edge-cache/` — 8 real Vitest tests against the actual Worker `fetch()` handler (real `Request`/`Response`/fake `KVNamespace`), all passing | Never deployed to a real Cloudflare account (none exists here) — `wrangler deploy` has never been run |
| AI gateway tiering/cost governance | T0/T1/T2 routing, semantic cache, kill switch | 13 new Vitest tests (`gateway/__tests__/{router,model-tier,backpressure,cost-governance}.test.ts`) covering T0 short-circuit, T1 kill-switch routing, semantic-cache cross-request hits, backpressure rejection, and cost-budget-check → kill-switch-flip logic — all against real code paths, not mocks of the logic under test | Never run against a real LLM provider under real cost pressure; the semantic cache is in-process (not shared across horizontally-scaled pods — a real gap for a multi-replica deployment, documented in `gateway/semantic-cache.ts`) |
| Destructive-DDL CI guard | Blocks a violating migration | Ran for real against this repo's actual migration history: correctly flagged the two known pre-Phase-12 destructive migrations (`0017`'s `DROP TABLE`, `0020`'s `RENAME COLUMN`) under `--all`, and correctly passed the two new Phase 12 migrations under `--since` | The GitHub Actions wiring (`migrations-lint` job) has never actually run inside GitHub Actions — validated locally with `actionlint` (0 errors) and by running the underlying script directly, not by observing a real workflow run |
| Chaos/failover drill | Region kill, DB failover, quarterly cadence | **One real drill executed** — local Postgres container killed and restarted against the actual running API process; `/v1/health` stayed up, `/v1/ready` correctly failed, `/v1/system/degradation` correctly reported `reference_only`, recovery confirmed in 2s post-restart | Single-instance/single-region only (no second region exists to fail over to); not on any recurring schedule yet; no load was concurrently applied |
| Observability/alerting | SLO burn-rate alerts | Prometheus rules validated with real `promtool check rules`/`check config`, then loaded into an actually-running Prometheus container (`docker compose up prometheus`) and confirmed `"health":"ok"` on every rule via the live `/api/v1/rules` endpoint | No Alertmanager exists in this stack — rules evaluate and would populate Prometheus's own UI, but nothing routes a firing alert to a human yet |

## Everything in one sentence

Every piece of Phase 12 infrastructure that *can* be verified without a live cloud account or
Kubernetes cluster (code correctness, schema validity, container runtime behavior, script logic,
CI config syntax, a real localhost chaos drill) *has* been verified with a real tool against real
output — nothing here is invented text describing infrastructure that was never exercised at all.
What remains untested is exactly the part that requires infrastructure this environment doesn't
have: a real Kubernetes cluster, a real Cloudflare account, real production traffic, and a second
provisioned region.

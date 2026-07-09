# Enterprise Scale & Reliability — Phase 12 Reference

**Effective:** 2026-07-09 · **Phase:** 12 (Global Enterprise Edition)
**Flags:** `global.p12.ai_cost_kill_switch`, `global.p12.ai_gateway_semantic_cache`,
`global.p12.k8s_worker_migration`, `global.p12.degradation_ladder`
**Related:** [ADR-0026](adr/ADR-0026-enterprise-scale-reliability.md) (full decision record — read
that first; this is a compact reference, not a duplicate)

## What's where

| Area | Location |
|---|---|
| K8s manifests (Helm) | `infra/helm/nutrimind/` |
| Dockerfiles | `apps/api/Dockerfile` (targets: `api`, `worker`) |
| Cloudflare edge barcode cache | `infra/cloudflare/barcode-edge-cache/` |
| AI gateway tiering/cache/backpressure/cost | `apps/api/src/gateway/{model-tier,semantic-cache,backpressure,cost-governance}.ts` |
| Job-stub wiring | `apps/api/src/jobs/registry.ts` (weekly-report, embed-*, fitbit/garmin-sync, health-sync-fanout) |
| Destructive-DDL guard | `scripts/lint-migrations.ts`, `.github/workflows/ci.yml`'s `migrations-lint` job |
| Canary deploy | `scripts/cd/deploy-canary.sh`, `.github/workflows/cd.yml`'s `backend` job |
| Readiness/degradation | `apps/api/src/routes/v1/{ready,system}.ts`, `apps/api/src/reliability/degradation.ts` |
| SLOs + alerting | `docs/slo/core-paths.md`, `observability/alerting/slo-burn-rate.rules.yml` |
| Capacity model | `docs/scale/capacity-model.{md,mjs}` |
| Tested-vs-designed accounting | `docs/scale/limits.md` |
| Chaos drill | `docs/scale/failover-drill-2026-07-09.md` |
| Load test scripts + smoke results | `k6/{scan,copilot}-load.js`, `docs/scale/loadtests/2026-07-09-smoke-verification.md` |

## New feature flags

| Flag | Purpose | Default |
|---|---|---|
| `global.p12.ai_cost_kill_switch` | Forces T2→T1 model routing globally when the daily LLM cost budget is exceeded; flipped by the `ai-cost-budget-check` pg-boss job | `false` |
| `global.p12.ai_gateway_semantic_cache` | Marks that the embedding-similarity response cache exists (`cacheScope: 'global'` requests only) | `false` |
| `global.p12.k8s_worker_migration` | Marks that a K8s topology for worker/gateway services exists (still pg-boss-triggered, not a real CronJob, until a cluster exists) | `false` |
| `global.p12.degradation_ladder` | Marks that the explicit reliability degradation ladder is wired on core paths | `false` |

## Endpoints (new)

| Endpoint | Purpose |
|---|---|
| `GET /v1/ready` | Readiness (DB reachability) — distinct from `/v1/health` (liveness, process-alive only) |
| `GET /v1/system/degradation` | Current degradation-ladder rung (`full`/`ai_degraded`/`reference_only`) |
| `GET /v1/gateway/status` (extended) | Now also reports backpressure in-flight count and the cost-governance kill-switch state |

## Known gaps (tracked, not fabricated as solved)

- `apps/api/src/copilot/*` (orchestrator, guardrails, streaming, grounding-verifier) is real code
  wired to **no route anywhere** — found this phase while fixing the k6 load test that assumed it
  existed. Not fixed here (separate feature-completion effort). See ADR-0026 §9.
- Semantic cache (`gateway/semantic-cache.ts`) is in-process — not shared across horizontally
  scaled pods.
- `http_server_duration` (the real exported metric) has no route/path label, so SLO burn-rate
  alerts are aggregate-API-wide, not per-core-path.
- No Alertmanager in the observability stack — SLO alerts evaluate but don't reach a human yet.
- No real K8s cluster or Cloudflare account exists anywhere to deploy any of this phase's infra
  to — see `docs/scale/limits.md` for the complete tested-vs-designed accounting.
- Four more pre-existing silent defects found and fixed this phase (job-handler table/column/shape
  mismatches, `llm_call_log`'s wrong columns + cache-hit double-charging, the Dockerfile path/
  dependency/Node-version trio, the missing `observability/docker-compose.yml` volume mount) — all
  detailed in ADR-0026.

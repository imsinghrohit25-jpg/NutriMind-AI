# SLOs — Core Paths (Phase 12, §13.5)

**Status:** Phase 12 — targets defined, error-budget math done, ONE real Prometheus burn-rate
rule wired (aggregate API availability). Per-path breakdown is a documented, not-yet-implemented
follow-up — see "Known gap" below.

## Core paths (per the addendum's own list)

| # | Path | Why it's "core" |
|---|---|---|
| 1 | Auth (login/session) | Nothing else works without it |
| 2 | Barcode resolve (`POST /v1/resolve/barcode`) | The primary scan flow |
| 3 | Allergen gate (`detectAllergens()`, always in-process on the resolve/scan path) | Safety-critical — never degrades, see below |
| 4 | Meal view / meal log read | Second most-used screen after scanning |
| 5 | Food log write (`meal_logs` insert paths) | Data-loss-sensitive |

## Targets and error budgets

99.9% monthly availability (the addendum's own design ceiling is 99.99% — this doc sets the
*enforced* target lower, deliberately, because no real load test or multi-region failover has
ever been run against this system; claiming 99.99% today would be exactly the kind of
design-ceiling-vs-tested-limit conflation `docs/scale/limits.md`'s honesty rule exists to
prevent). 99.9%/month = **43m 12s** of allowed downtime per 30-day month.

| Metric | Target | Error budget (30d) |
|---|---|---|
| Availability (non-5xx rate) | 99.9% | 43m 12s downtime-equivalent |
| Latency — barcode resolve, p95 | < 1.5s (addendum §14 Phase 12 gate) | n/a (latency SLOs use burn on % of requests over threshold, not time) |
| Latency — general API, p95 | < 800ms | — |

## Burn-rate windows (Google SRE multi-window method)

| Alert | Long window | Short window (reset check) | Burn rate | Consumes 30d budget in | Severity |
|---|---|---|---|---|---|
| `APIErrorBudgetBurnFast` | 1h | 5m | ≥ 14.4x | ~2 days at this rate | page |
| `APIErrorBudgetBurnSlow` | 6h | 30m | ≥ 6x | ~5 days at this rate | ticket |

Implemented in `observability/alerting/slo-burn-rate.rules.yml`. Each alert requires BOTH windows
over threshold simultaneously — the standard multi-window trick that stops a single short blip
from paging on its own while still catching a real, sustained burn quickly.

## Safety features are NOT on this ladder

The Health Score Engine and Allergen Hard Gates are pure functions with no I/O and no LLM
dependency (`memory/__tests__/safety-boundary.test.ts` proves this at the source-import level,
not just by convention). They cannot appear in an SLO burn-rate calculation because they have no
external dependency that can fail independently of the process itself being up — if the process
is up, they compute correctly; if it's down, EVERYTHING is down, which is what the availability
SLO above already measures. A separate "allergen gate SLO" would just be a less complete copy of
the availability SLO.

## Known gap (documented, not fabricated as solved)

`http_server_duration` (the real metric this API actually exports — confirmed by starting the
server locally with `initTelemetry()` and scraping `:9464/metrics` directly during this phase) has
**no route/path label** — only `http_method`, `http_status_code`, `http_flavor`, `http_scheme`,
`net_host_port`. This means the burn-rate rule below is necessarily an **aggregate API-wide**
SLO, not a genuinely per-path one (barcode resolve vs. meal view vs. auth cannot be distinguished
today). Getting real per-path SLOs requires adding an `http.route` span/metric attribute — either
upgrading `@opentelemetry/instrumentation-fastify` to a version that sets it, or adding a small
`onRequest`/`onResponse` hook that records it manually. Not done in this phase; tracked here so
it isn't silently forgotten.

## Degradation ladder (§13.5)

Server-side (new this phase): `apps/api/src/reliability/degradation.ts` (`computeDegradationLevel`)
classifies `full` / `ai_degraded` / `reference_only` from real signals (DB reachability via the new
`GET /v1/ready`, AI provider circuit-breaker state) — exposed at `GET /v1/system/degradation`.
`/v1/health` (liveness) and `/v1/ready` (readiness) are now deliberately different endpoints: a
database blip must pull a pod out of a Service's rotation, not restart the process (see
`docs/scale/failover-drill-2026-07-09.md` for this proven against a real outage).

Client-side offline-first mode (§13.5: "log locally, sync later") **already existed before this
phase** — `apps/mobile/lib/core/offline/scan_queue.dart` (Drift-backed pending-scan queue) and
`sync_engine.dart` (drains the queue on reconnect) were built pre-Phase-12 and were simply never
connected to this phase's server-side ladder terminology until now. Allergen gates already run
fully on-device per Phase 9 (a hard requirement independent of this ladder, not newly satisfied
by it).

## RTO/RPO and failover

See `docs/scale/failover-drill-2026-07-09.md` for the first (real, local-scale) chaos drill and
its measured recovery time, and `docs/scale/limits.md` for what's tested vs. designed.

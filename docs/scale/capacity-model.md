# Capacity Model (Phase 12, §13.5)

Spreadsheet-as-code, not a spreadsheet: `docs/scale/capacity-model.mjs` is the single source of
truth for every number below. Run `node docs/scale/capacity-model.mjs` to regenerate — never
hand-edit the numbers in this table without also updating the assumptions in that file, or the
two will silently drift apart.

## Assumptions

| Assumption | Value | Source |
|---|---|---|
| Registered users | 100,000,000 | Addendum §13.1 design ceiling |
| Daily active fraction | 15% | Typical consumer nutrition-app DAU/MAU-style range (assumption, not measured — this product has no production users yet) |
| Scans per DAU per day | 3 | Primary daily action assumption |
| AI conversations/day | 10,000,000 | Addendum §13.1 design ceiling |
| Peak/average ratio | 4x | Meal-time clustering (breakfast/lunch/dinner bursts) |
| Barcode cache hit rate | 90% | Addendum §13.1 target (`cache/edge-cache.ts` + the Cloudflare Worker built this phase) |
| DB connections per pod | 10 | Matches `app.ts`'s `postgres()` pool `max: 10` |
| Target CPU utilization | 70% | Matches `values.yaml`'s `api.autoscaling.targetCPUUtilizationPercentage` |
| Requests/pod/sec capacity | 150 | **Untested estimate** — no real load test has been run at this scale (see `docs/scale/limits.md`) |
| Cost per pod-hour | $0.05 | Rough small-pod (0.5 vCPU/512Mi) estimate, not a real cloud quote |
| Cost per LLM call | $0.003 | Blended T0(free)/T1/T2 mix estimate, not measured (see `llm_call_log`, now actually populated after this phase's cost-log.ts fix — a real average can be computed from it once there's real traffic) |

## Computed (output of `node docs/scale/capacity-model.mjs`)

| Metric | Value |
|---|---|
| Daily active users | 15,000,000 |
| Scans/day | 45,000,000 |
| Avg scan QPS | 520.83 |
| **Peak scan QPS** | **2,083.33** |
| DB-hitting scan QPS at peak (after 90% cache hit) | 208.33 |
| **Pods needed for scan traffic at peak** | **14** |
| DB connections needed at peak | 140 |
| Avg AI QPS | 115.74 |
| Peak AI QPS | 462.96 |
| Est. monthly LLM cost (10M/day conversations) | **$900,000** |
| Est. monthly pod cost (scan traffic only, excludes worker/AI-gateway/DB/CDN egress) | $504 |

## What this model deliberately does NOT include

- Worker pod costs (ETL, memory aggregation, embeddings) — no throughput assumption exists for
  these yet.
- AI gateway compute cost separate from the LLM provider bill itself (the $900k/mo above is
  provider API spend, not the pods routing to it).
- Supabase managed-service cost (Postgres/Auth/Storage) — pricing depends on a real provisioned
  tier, not designed here.
- Cloudflare Workers/KV/CDN cost — usage-based, no real traffic to estimate from.
- Multi-region multiplier — this entire model is single-region (`ap-south-1`) arithmetic; a real
  `eu-west-1`/`us-east-1` rollout would roughly multiply pod/DB costs by however many regions
  actually serve traffic, minus whatever fraction Cloudflare's edge cache absorbs.

## Honesty check

Every number here is **derived from an assumption, not a measurement** — this repo has zero
production users and no load test has been run anywhere near these QPS figures (the highest VU
count any k6 script has actually been run at is a 2-VU/4-iteration smoke check, see
`docs/scale/loadtests/2026-07-09-smoke-verification.md`). This model exists to make planning
conversations concrete (§13.5's own ask: "capacity model... mapping users→QPS→DB connections→pod
counts→cost, with assumptions listed"), not to claim these figures are validated.

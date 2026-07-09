# Failover / Chaos Drill — 2026-07-09

**Status:** Real, executed drill (not a tabletop exercise) — first one run against this repo's
degradation-ladder code (§13.5's "chaos experiments: region kill, DB failover... quarterly
drill"). Scope is honestly narrower than the addendum's own target: this is a **single-instance,
local-Docker DB kill**, not a multi-region failover (no second region is provisioned anywhere —
`region/registry.ts`'s `ACTIVE_REGION` is `ap-south-1` only, `eu-west-1`/`us-east-1` are `live:
false`). It proves the degradation-ladder CODE works against a real Postgres outage; it does not
and cannot prove cross-region failover, which needs infrastructure that doesn't exist yet.

## What was tested

`apps/api` (real process, `tsx src/server.ts`) running against the real local Supabase Docker
stack (`supabase_db_nutrimind` + Kong/PostgREST/Auth — the same stack Phase 11 discovered and
used to verify migrations 0001–0024; this drill is the first time it's been used to verify
*runtime* behavior rather than migration application).

**Important correction made during this drill:** the repo's real `.env` had `DATABASE_URL` and
`SUPABASE_URL` pointed at a remote hosted Supabase project (`*.supabase.co`), not the local Docker
stack — stopping the local container would have had **zero effect** on a server using that config
(confirmed: it didn't). A throwaway, gitignored `apps/api/.env` was used for this drill, pointed at
`127.0.0.1:54322`/`127.0.0.1:54321` with the standard public local-dev demo JWTs (not secrets —
published in Supabase's own docs, identical across every local `supabase start`), and deleted
immediately after. No real credentials were touched or exposed. This mismatch between the repo's
`.env` and the actually-running local stack is itself worth knowing for future sessions.

## Procedure and results

| Step | Time | Observation |
|---|---|---|
| Baseline | T+0 | `/v1/health` 200, `/v1/ready` 200, `/v1/system/degradation` → `full` |
| Fault: `docker stop supabase_db_nutrimind` | T+0 | — |
| Immediately after (1s later) | T+1s | `/v1/health` **still 200** (liveness correctly independent of DB — see below); `/v1/ready` **503**, `reason: database_unreachable`, real `ECONNREFUSED 127.0.0.1:54322`; `/v1/system/degradation` → **`reference_only`** |
| Recovery: `docker start supabase_db_nutrimind` | T+~14s (human reaction time to issue the command, not a system property) | — |
| `/v1/ready` polled every 1s | | Returned to 200 **2 seconds** after the container restart command |
| Total fault-to-recovery | **16s** | Includes ~14s of manual/human delay between injection and issuing the restart command — the actual *system* recovery time (container restart → app detects DB reachable again) is the **2s** component, not the 16s total |

## What this proves

1. **Liveness/readiness split works as designed** (Phase 12 addition, this same phase):
   `/v1/health` never flapped during the outage — a DB blip does not cause Kubernetes to kill and
   restart API pods (which would accomplish nothing, since the process itself was never the
   problem). `/v1/ready` correctly flipped to 503 within the first post-fault check, which is what
   would pull a real pod out of a Service's load-balancing rotation.
2. **The degradation ladder (`reliability/degradation.ts`) correctly classifies a real outage**,
   not just its unit tests: `reference_only` was reported the instant the DB ping failed, with the
   real underlying error surfaced (`detail: "connect ECONNREFUSED 127.0.0.1:54322"`), not a
   swallowed/generic failure.
3. **Recovery is fast once the dependency is back** — 2 seconds from container restart to the
   app's own health check confirming it, which matches expectations for `postgres.js`'s connection
   pool re-establishing a connection with no additional app-level retry/backoff logic needed.

## What this does NOT prove (honest gaps)

- No traffic was actually flowing through a Kubernetes Service/readinessProbe during this drill —
  there is no real cluster to run one, so the "pod pulled out of rotation" claim above is a code
  correctness statement (503 returned) not an observed K8s scheduling behavior.
- No second region exists to fail over TO. A real region-kill drill needs `eu-west-1` or
  `us-east-1` actually provisioned.
- No load was applied during the outage (see `docs/scale/loadtests/` for load-test-only results,
  run separately, also without a live outage concurrently injected). A combined
  chaos-under-load drill is a natural next drill, not done here.
- This was a single ad-hoc manual run, not the "quarterly" cadence the addendum asks for — there is
  no scheduled recurrence of this drill yet (no CronJob/GitHub Actions schedule exists to
  automate it).

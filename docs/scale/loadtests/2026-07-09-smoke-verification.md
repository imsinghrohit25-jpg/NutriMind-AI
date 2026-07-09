# Load Test Smoke Verification — 2026-07-09

**This is NOT a load test result.** It's proof the two k6 scripts (`k6/scan-load.js`,
`k6/copilot-load.js`) actually work against real, running endpoints — found necessary because
both scripts, when actually run for the first time this phase, immediately failed: they targeted
endpoints that have never existed in this build track.

## What was found and fixed

- **`k6/scan-load.js`**: targeted `GET /api/v1/scan/:barcode`. The real endpoint (unchanged since
  Phase 3) is `POST /v1/resolve/barcode` with a JSON body. Fixed; also added a cache-hit-rate
  check (`scan_cache_hit`, addendum §13.1's ">=90%" target) and a `responseCallback` telling k6
  that a 404 (`not_found`, a real documented outcome) isn't a request failure.
- **`k6/copilot-load.js`**: targeted `POST /api/v1/copilot/chat`. **This endpoint has never
  existed in this build track.** `apps/api/src/copilot/{orchestrator,guardrails,streaming,
  grounding-verifier,memory}.ts` is real, non-trivial code (conversational orchestration, input
  guardrails, SSE streaming helpers, RAG grounding verification) but **is not wired to any route
  in `routes/v1/`** — confirmed by grepping every route file for a reference to `copilot/` and
  finding none. This is a significant, previously-undocumented finding, on the same scale as the
  Phase 8 "6 unregistered route files" bug, except here no route file exists to register at all.
  **Not fixed in this phase** — wiring a full SSE-streaming conversational endpoint (with
  guardrail integration, grounding verification, and its own test suite) is a separate
  feature-completion effort, not "Enterprise Scale infra" work. Documented here and in the
  Phase 12 summary so it isn't silently lost. The script was rewritten to target the real,
  reachable `POST /v1/gateway/complete` instead, with metric names/thresholds relabeled
  T0/T1 (matching `gateway/model-tier.ts`, built this same phase) rather than "guardrail"/"llm".

## Smoke runs actually executed (real server, real local Supabase Postgres, trivial VU counts)

Both runs used `apps/api` (`tsx src/server.ts`) against the real local `supabase_db_nutrimind`
Docker stack (same one used for the chaos drill, `failover-drill-2026-07-09.md`) — NOT the
project's real remote Supabase project (a throwaway, gitignored `apps/api/.env` override was used
and deleted immediately after, same technique as the chaos drill).

### `scan-load.js` — 2 VUs, 4 iterations

```
scan_latency: avg=485.5ms p(95)=806.75ms   (threshold: p95<1500ms — PASS at this trivial scale)
scan_errors:  0%                            (threshold: <1% — PASS)
http_req_failed: 0%                         (after the responseCallback fix — was 100% before it)
checks: 8/8 passed (status 200/404 + envelope shape)
```
No products are seeded in this throwaway local DB, so every request correctly waterfalls to
`not_found` (404) — this proves the endpoint, request/response shapes, and error handling work
end-to-end, but says nothing about real p95 latency or cache-hit-rate under actual load or with
real seeded products. **A real 50-VU/2-minute run against a properly seeded database has not been
performed.**

### `copilot-load.js` — 1 VU, 2 iterations

Reached `/v1/gateway/complete` successfully (correct request shape, real route), but returned
`401 UNAUTHENTICATED` for both the T0 and T1 scenarios — the placeholder `TEST_JWT` value
(`'test-token'`) is not a real Supabase-issued JWT, and `plugins/auth.ts` correctly rejected it
(validated against real Supabase JWKS, not bypassed) — this is CORRECT auth behavior, not a bug.
**A real run requires a real JWT from a seeded test user and at least one LLM provider API key
configured on the server process; neither was set up for this smoke check.** The 401 response
itself is useful evidence: it proves auth enforcement is real and not silently bypassable, which
is arguably more valuable than a successful 200 would have been for a security-adjacent finding.

## Honest summary

What's proven: both scripts hit real endpoints with correct request/response shapes, and the
scan-load fix (404-as-valid-outcome) is verified correct. What's NOT proven: sustained load
behavior at the addendum's target VU counts, real cache-hit-rate under repeat traffic against
seeded data, or AI gateway latency with a real provider key and real auth. See
`docs/scale/limits.md` for the full tested-vs-designed accounting.

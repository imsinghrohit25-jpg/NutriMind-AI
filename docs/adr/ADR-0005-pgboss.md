# ADR-0005 — Job Queue: pg-boss on Supabase Postgres

**Date:** 2026-07-07  
**Status:** Accepted  
**Phase:** 2

## Context

NutriMind needs reliable background job processing for:
- Weekly report generation (scheduled, once per user per week)
- Product/chunk/user-history embedding (deferred after scan completion)
- Push notification delivery (Phase 10)
- Curation queue processing (Phase 3+)

Evaluated: pg-boss, BullMQ (Redis), Inngest, Trigger.dev.

## Decision

**pg-boss** backed by the existing Supabase Postgres (mandated by BUILD_PLAN.md § 2).

## Rationale

| Criterion | pg-boss | BullMQ/Redis | Inngest |
|---|---|---|---|
| Infrastructure | reuses existing Postgres | needs Redis | external SaaS |
| Mandated by plan | ✅ explicit | ❌ | ❌ |
| Retry + backoff | ✅ configurable | ✅ | ✅ |
| Dead-letter queue | ✅ archive table | ✅ | ✅ |
| Deduplication (idempotency) | ✅ `singletonKey` | ✅ | ✅ |
| Scheduled jobs (cron) | ✅ built-in | ✅ | ✅ |
| Zero new infrastructure | ✅ | ❌ | ❌ |

Supabase Postgres connection pool (10 connections) is sufficient for v10 pg-boss at current
expected job volume (< 10k jobs/day).

## Configuration

```typescript
new PgBoss({
  connectionString: DATABASE_URL,
  schema: 'pgboss',            // isolated from public schema
  archiveCompletedAfterSeconds: 604800,  // 7 days
  deleteAfterDays: 30,
  monitorStateIntervalSeconds: 30,
})
```

## Idempotency convention

Every job that should not be duplicated uses a deterministic `singletonKey`:
```
SHA-256(JSON.stringify({ jobName, input }))
```
Implemented in `apps/api/src/jobs/idempotency.ts`.

## Retry/backoff policy per job type

| Job | retryLimit | retryDelay | retryBackoff |
|---|---|---|---|
| weekly-report | 3 | 300s | true (exponential) |
| embed-product | 5 | 60s | true |
| embed-knowledge-chunk | 5 | 60s | true |
| embed-user-history | 3 | 120s | true |
| push-notification | 3 | 30s | false |

## Consequences

- pg-boss adds `pgboss` schema to the database — documented, isolated.
- Worker process must stay running (Fly.io Machine or always-on container).
- Supabase connection limits apply — monitor with Grafana dashboard.

## Review triggers

- If job volume exceeds 100k/day (consider dedicated Redis + BullMQ)
- If real-time requirements emerge (BullMQ has better sub-second latency)

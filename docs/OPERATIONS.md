# NutriMind AI — Operations Guide

## Environments

| Env        | API URL                        | Supabase Project | Branch  |
|------------|--------------------------------|------------------|---------|
| local      | http://localhost:3000          | local (supabase start) | any |
| staging    | https://api-staging.nutrimind.app | nutrimind-staging | main |
| production | https://api.nutrimind.app      | nutrimind-prod   | tags only |

## Starting the Stack Locally

```bash
# 1. Start Supabase (requires Docker)
npx supabase start

# 2. Start API
cd apps/api
cp .env.example .env          # fill in keys
npm run dev

# 3. Start mobile (requires Flutter 3.24+)
cd apps/mobile
flutter run
```

## Environment Variables (API)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Backend-only service key (never shipped in mobile) |
| `SUPABASE_ANON_KEY` | ✅ | Public anon key (used in mobile as well) |
| `USDA_FDC_API_KEY` | ✅ | USDA FoodData Central API key |
| `ANTHROPIC_API_KEY` | ✅ | LLM gateway primary key |
| `OPENAI_API_KEY` | optional | LLM gateway fallback |
| `FCM_ACCESS_TOKEN` | optional | Firebase Cloud Messaging (push notifications) |
| `APNS_JWT` | optional | Apple Push Notification JWT |
| `FIREBASE_PROJECT_ID` | optional | Firebase project ID |
| `APNS_BUNDLE_ID` | optional | iOS bundle ID (`com.nutrimind.app`) |
| `APNS_ENV` | optional | `sandbox` or `production` |
| `DATABASE_URL` | ✅ | Direct Postgres URL (for pg-boss) |

## pg-boss Job Schedules

| Job | Schedule (IST) | Description |
|-----|----------------|-------------|
| `weekly-report` | Every Monday 08:00 | Send weekly nutrition summary push to all users |
| `embed-product` | On demand | Embed new product into knowledge_chunks |
| `embed-knowledge-chunk` | On demand | Re-embed a knowledge chunk on corpus update |

## Monitoring

| Signal | Alert condition |
|--------|-----------------|
| API error rate | > 1% 5xx in 5 min window |
| Score engine test failures | Any CI gate failure on main |
| LLM grounding violations | > 5% ungrounded responses in 1 hour |
| Push delivery failures | > 10% FCM failures in 1 hour |
| pg-boss failed jobs | Any job in `failed` state > 3 retries |

## Database Migrations

```bash
# Apply new migration
npx supabase db push

# Generate migration from schema diff
npx supabase db diff -f <migration_name>

# Reset local DB (destructive — local only)
npx supabase db reset
```

## Corpus Ingestion

```bash
# Ingest a new knowledge document
cd apps/api
npx tsx src/knowledge/ingest/ingest.ts --file data/knowledge/who-sodium-2023.pdf

# Update CORPUS_VERSION in versioning.ts when methodology changes
```

## Runbook — LLM Provider Outage

1. Circuit breaker opens automatically after 5 consecutive failures
2. Fallback provider activates (configured in `gateway/router.ts`)
3. If both providers down: parse_assist tier degrades to regex-only parse; copilot returns 503 with `COPILOT_UNAVAILABLE` error
4. Score engine continues unaffected (deterministic, no LLM)
5. Alert on-call via Grafana → PagerDuty when fallback also fails

## Runbook — pg-boss Worker Kill

1. pg-boss uses advisory locks; jobs not lost if worker dies mid-execution
2. `retry_limit = 3`; jobs requeued automatically after `expire_in_seconds = 900`
3. Dead-letter queue at `pgboss.archive` — query for jobs in `failed` state
4. Manual requeue: `SELECT pgboss.resume_job('<job_id>')`

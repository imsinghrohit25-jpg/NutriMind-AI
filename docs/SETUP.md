# NutriMind AI — Setup Guide (v1, Phase 2)

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 (24 recommended) | https://nodejs.org |
| npm | ≥ 10 | bundled with Node |
| Docker Desktop | latest | https://docker.com |
| Supabase CLI | ≥ 2.109 | `npm i -g supabase` |
| Git | any | https://git-scm.com |

## 1. Clone and install

```bash
git clone <repo-url> nutrimind
cd nutrimind
npm install          # installs all workspaces: apps/api, packages/shared, supabase/tests
```

## 2. Environment

```bash
cp .env.example .env
```

Fill in `.env`. Required values:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_JWKS_URL` | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `DATABASE_URL` | Supabase Dashboard → Project Settings → Database → URI |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `OPENAI_API_KEY` | https://platform.openai.com |
| `GEMINI_API_KEY` | https://aistudio.google.com |

For local development only, leave LLM keys blank — the gateway will be disabled and
`/v1/gateway/complete` returns 503 with `GATEWAY_UNAVAILABLE`.

## 3. Local Supabase (optional — Phase 1 migrations already pushed to cloud)

```bash
supabase start                        # starts local Docker stack
supabase db reset                     # apply all migrations + seeds
npm run test:db                       # RLS tests (22 tests)
```

## 4. Run the API server

```bash
cd apps/api
npm run dev                           # tsx watch src/server.ts  (port 3000)
# or
npm run dev:worker                    # pg-boss workers (separate terminal)
```

## 5. Run tests

```bash
# All workspaces
npm test

# API only
npm run test --workspace=apps/api

# With coverage
npm run test:coverage --workspace=apps/api
```

## 6. Observability stack (optional)

```bash
cd observability
docker compose up -d
```

| Service | URL |
|---|---|
| Grafana | http://localhost:3001 (admin/nutrimind) |
| Jaeger UI | http://localhost:16686 |
| Prometheus | http://localhost:9090 |
| OTEL Collector | http://localhost:4318 |

## 7. Scripts

```bash
bash scripts/secret-scan.sh          # fail if secrets in git
bash scripts/audit-no-mock.sh        # fail if mock/placeholder in src
npx tsx scripts/audit-llm-writes.ts  # fail if LLM→score write paths
```

## 8. Project structure

```
apps/api/src/
  server.ts          ← API entry point (binds port)
  worker.ts          ← pg-boss worker entry point
  app.ts             ← Fastify factory (testable)
  env.ts             ← env validation (Zod)
  plugins/           ← auth (JWKS), rbac, rate-limit, otel, error-handler
  gateway/           ← AI gateway: router, adapters, circuit-breaker, cost-log
  jobs/              ← pg-boss: boss singleton, registry, idempotency
  policy/            ← output-policy (diagnosis/score contradiction blocks)
  telemetry/         ← OTEL init, health-data redaction processor
  routes/v1/         ← HTTP routes (health, gateway)
packages/shared/src/
  schemas/           ← Zod schemas: envelope, LLM types
  openapi.ts         ← OpenAPI spec builder
config/
  routing.json       ← task-tier → provider/model policy (checked in)
observability/
  docker-compose.yml ← OTEL, Jaeger, Prometheus, Grafana
```

## 9. Phase gate checklist (Phase 2)

- [ ] `npm run typecheck --workspace=apps/api` — zero errors
- [ ] `npm run typecheck --workspace=packages/shared` — zero errors
- [ ] `npm run test --workspace=apps/api` — all tests pass
- [ ] `bash scripts/secret-scan.sh` — clean
- [ ] `bash scripts/audit-no-mock.sh` — clean
- [ ] Real Anthropic prompt → logged to `llm_call_log` (requires key)
- [ ] Real OpenAI prompt → logged (requires key)
- [ ] Real Gemini prompt → logged (requires key)
- [ ] OpenAI-compat (Ollama) prompt → logged (requires local Ollama)
- [ ] OTEL trace visible in Jaeger for one API→queue→worker flow

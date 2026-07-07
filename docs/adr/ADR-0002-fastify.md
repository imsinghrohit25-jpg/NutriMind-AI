# ADR-0002 — Backend Framework: Fastify

**Date:** 2026-07-07  
**Status:** Accepted  
**Phase:** 2

## Context

NutriMind needs a TypeScript API server that handles:
- Long-lived background workers (pg-boss job processing)
- Server-Sent Events (SSE) streaming for the Health Copilot
- OpenTelemetry instrumentation with full trace context propagation
- Per-route schema validation with Zod
- Production-grade rate limiting keyed on JWT user_id

Evaluated: Next.js API Routes, Hono, Express, Fastify.

## Decision

**Fastify** with TypeScript strict mode and ESM modules.

## Rationale

| Criterion | Fastify | Next.js API Routes | Hono | Express |
|---|---|---|---|---|
| Long-lived workers (pg-boss) | ✅ standalone process | ❌ serverless model | ✅ | ✅ |
| SSE streaming | ✅ native | ⚠️ awkward in App Router | ✅ | ✅ |
| OTEL instrumentation | ✅ first-class plugin | ⚠️ layered on top | ⚠️ manual | ⚠️ manual |
| JSON schema + serialization | ✅ built-in, fast | ❌ external | ⚠️ partial | ❌ external |
| TypeScript plugin system | ✅ `fastify-plugin` | ❌ | ✅ middleware | ❌ |
| No React coupling | ✅ | ❌ pulls in React | ✅ | ✅ |
| Ecosystem maturity | ✅ v4, stable | ✅ | ✅ | ✅ |

Fastify's plugin + decorator system lets us isolate auth, rate-limit, and OTEL as first-class
concerns without global middleware ordering issues.

## Architecture

```
server.ts   ← init OTEL first, then import app
app.ts      ← registerPlugins: helmet, cors, errorHandler, auth, rbac, rate-limit, otel
              ← register routes: /v1/**
worker.ts   ← separate entry point; same DATABASE_URL; pg-boss workers only
```

One deployable image, two process roles (API server + worker) controlled by the Docker CMD.

## Consequences

- No incremental static generation or edge deployment — not needed for this API.
- Must manage OTEL SDK lifecycle explicitly (done in `server.ts` / `worker.ts`).
- Plugin dependency order is explicit — a feature, not a limitation.

## Review triggers

- If mobile client needs GraphQL subscriptions (revisit transport layer)
- If deploy target shifts to Cloudflare Workers / Deno Deploy (reconsider runtime)

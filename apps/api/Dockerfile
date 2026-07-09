# NutriMind API — Phase 12 (§13.2 compute topology). Builds two runtime images from one
# Dockerfile: `api` (the Fastify HTTP server, incl. AI gateway routes) and `worker` (the pg-boss
# job consumer — ETL sync, memory aggregation, embeddings, report/export jobs).
#
# Build context MUST be the repo root (not apps/api) — this workspace depends on
# packages/shared, and Docker's build context can't reach outside the Dockerfile's directory
# otherwise:
#   docker build -f apps/api/Dockerfile --target api    -t nutrimind-api:local    .
#   docker build -f apps/api/Dockerfile --target worker -t nutrimind-worker:local .
#
# Node 22, not 20 (root package.json's engines floor): found by actually running this image —
# @supabase/supabase-js@2.110.1's realtime-js dependency throws "native WebSocket not found" on
# Node 20 at SupabaseClient construction time (every request touching fastify.supabase), a real
# crash npm's install-time "Unsupported engine" warning for the same package had already flagged
# but nothing had ever surfaced as a hard failure before this image was actually run.

FROM node:22-alpine AS base
WORKDIR /repo
RUN corepack enable

# --- deps: install once, reused by both final stages ---------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY supabase/tests/package.json supabase/tests/package.json
RUN npm ci

# --- build: compile TS -> dist for both workspaces ------------------------------------------
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY config config
RUN npm run build --workspace=packages/shared \
 && npm run build --workspace=apps/api

# --- prod-deps: a second, production-only install (no devDependencies in the runtime image) --
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace=apps/api --workspace=packages/shared

# --- runtime base: shared by both final images ----------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -S nutrimind && adduser -S nutrimind -G nutrimind
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/config config
USER nutrimind

# --- api: the Fastify HTTP server (incl. /v1/gateway/*) -------------------------------------
FROM runtime AS api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=8s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Path has an extra apps/api/src nesting because tsconfig.json's `include` also pulls in
# packages/shared/src (so the two workspaces type-check against each other's real source, not
# stale .d.ts files) — TypeScript infers `rootDir` as the nearest common ancestor of every
# included file, which is the repo root, not apps/api. Found by actually running this image
# (`node dist/server.js` => MODULE_NOT_FOUND); apps/api/package.json's own start/start:worker
# scripts had the same wrong path and are fixed in the same commit.
CMD ["node", "apps/api/dist/apps/api/src/server.js"]

# --- worker: pg-boss job consumer (ETL, memory aggregation, embeddings, reports) ------------
FROM runtime AS worker
CMD ["node", "apps/api/dist/apps/api/src/worker.js"]

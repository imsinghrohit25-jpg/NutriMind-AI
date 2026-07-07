# ADR-0001: Monorepo Tooling — npm workspaces + standalone Flutter app

**Status:** Accepted
**Date:** 2026-07-07
**Deciders:** Phase 0/1 execution
**Context:** Phase 1 (database layer). Governs the repository structure for all phases.

---

## Context

NutriMind requires:
- A TypeScript backend service (`apps/api`) and shared schema/contract package (`packages/shared`)
- A Flutter mobile app (`apps/mobile`)
- Supabase migrations, seeds, and tests under `supabase/`
- Observability compose stack, scripts, and documentation

The toolchain must support:
1. Shared TypeScript types/schemas between `apps/api` and future generated Dart clients
2. Single `npm install` at repo root bootstraps all TS packages
3. Flutter app development does not require Node.js workspace entanglement
4. CI runs `npm run test`, `npm run lint`, `flutter test` as independent steps

---

## Decision

**npm workspaces** for all TypeScript packages:

```json
{
  "workspaces": ["apps/api", "packages/shared", "supabase/tests"]
}
```

**Flutter app stands alone** under `apps/mobile/` — no melos, no workspace linking.

Rationale:
- There is currently one Flutter package. Melos adds complexity only justified when managing multiple Flutter packages with interdependencies. Revisit at Phase 12 if packages split.
- npm workspaces is built into npm ≥7 (we use npm 11) — no additional tooling.
- `packages/shared` generates zod schemas → OpenAPI spec → Dart client via `openapi-dart-generator` in Phase 2. The generation step is a CI script, not a workspace link.
- Keeping Flutter independent avoids Windows-path and Node/Dart interop issues that compound in monorepo orchestrators on WSL2 + Windows environments.

---

## Alternatives Considered

| Option | Rejected because |
|--------|-----------------|
| **Turborepo** | Caching value is real but adds a layer of indirection; overkill for a two-TS-package repo at Phase 1 |
| **Nx** | Same complexity argument as Turborepo; also requires Nx-specific config patterns that reduce portability |
| **Melos** | Dart-centric; not suited to TS backend; cross-language orchestration is awkward |
| **Single flat package** | No isolation between backend and shared contracts; prevents clean Dart client generation |

---

## Repository layout produced

```
nutrimind/
├── apps/
│   ├── mobile/          # Flutter — standalone; flutter commands run from here
│   └── api/             # TypeScript Fastify service (Phase 2+)
├── packages/
│   └── shared/          # Zod schemas, OpenAPI types, generated Dart client (Phase 2+)
├── supabase/
│   ├── config.toml
│   ├── migrations/      # 0001–NNNN; rollback/ and validate/ subdirs
│   ├── seed/
│   └── tests/           # @nutrimind/db-tests workspace package
├── observability/        # docker-compose (Phase 2+)
├── data/
│   ├── ifct2017/        # gitignored; format doc committed
│   └── knowledge/       # corpus + manifest.json
├── docs/
│   ├── adr/
│   └── *.md
├── scripts/
└── .github/workflows/
```

---

## Consequences

- **Positive:** Minimal tooling surface; familiar npm commands; clear Flutter/TS boundary.
- **Positive:** Single `package.json` at root captures all TS dependencies for `npm audit`.
- **Negative:** No build-graph caching (Turborepo/Nx provide this). Acceptable at current scale; add Turborepo if CI time becomes a problem after Phase 6.
- **Negative:** Cross-language type sharing requires an explicit generation step (not automatic). Mitigated by making it a CI step in Phase 12.

---

## Review trigger

Re-evaluate if:
- A second Flutter package is added (→ consider Melos)
- CI build time exceeds 15 minutes for a full test run (→ consider Turborepo remote cache)
- A third TypeScript app is added that needs its own deployment unit (→ evaluate Nx)

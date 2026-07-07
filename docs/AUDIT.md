# NutriMind AI — Phase 0 Repository Audit

**Audit date:** 2026-07-07
**Auditor:** Phase 0 execution (Claude Code agent, per NutriMind Enterprise Master Prompt)
**Repository path:** `C:\Users\DELL\OneDrive\Desktop\NutriMind AI`

---

## 1. Verdict: GREENFIELD

The working directory contained **zero files and zero directories** (verified by recursive
enumeration including hidden files) prior to this audit. There is:

- **No existing application** (mobile or backend) — nothing to preserve, upgrade, or migrate.
- **No existing Supabase schema** — Phase 1 migrations start from an empty database.
- **No user data** — no data-preservation constraints apply to the initial build.
  (The Phase 1 acceptance criterion "migrations apply cleanly to existing databases" is still
  implemented and tested — via a seeded-then-migrated test database — because it protects every
  release *after* v1.)
- **No demo/mock elements to replace** — the zero-mock policy applies from the first line of code.
- **No reusable modules** — the reuse-vs-new decision table in `docs/BUILD_PLAN.md` § 4 is
  therefore all-new, except for the developer-environment assets listed below.

A git repository was initialized during this audit (`main` branch, no commits yet) so that all
subsequent phases operate under version control from the first file.

## 2. What DOES already exist (developer environment, not repo contents)

A full development-environment audit was completed and verified on 2026-07-07 (all green,
`docker run hello-world` passing). It is inventory, not code, but it constrains the plan:

| Asset | Version / Location | Relevance |
|---|---|---|
| Flutter (stable) | 3.44.5, `C:\src\flutter` | `apps/mobile` toolchain |
| Dart | 3.12.2 | strict analysis options target |
| Android SDK | android-36, build-tools 36.0.0, `%LOCALAPPDATA%\Android\Sdk` | Android builds |
| Android emulator | AVD `nutrimind_pixel` (android-36, x86_64) | integration tests |
| Java | Microsoft OpenJDK 21.0.11, `JAVA_HOME` set | Gradle |
| Node.js / npm | 24.16.0 / 11.13.0 | `apps/api`, tooling |
| Docker Desktop | engine 29.6.1 on WSL2 | Supabase local stack, observability compose |
| Supabase CLI | 2.109.1 | local Postgres + migrations |
| Git / GitHub CLI | 2.54.0 / 2.96.0 | VCS / CI (`gh auth login` still pending) |
| VS Code | 1.127.0 + Dart & Flutter extensions | IDE |

**Not installed (known, accepted):** Visual Studio C++ workload — only needed for Windows
*desktop* Flutter builds; product targets Android + iOS. **iOS builds require a macOS runner**
(no local Mac detected) — recorded as risk R-08 in the build plan; CI (Phase 12) provides the
macOS build lane via hosted runners/Fastlane.

## 3. Repository-location risk (flagged before any code is written)

The repo currently lives at `C:\Users\DELL\OneDrive\Desktop\NutriMind AI`:

1. **OneDrive sync** — known to corrupt/lock `.git`, `build/`, `.dart_tool/`, and
   `node_modules/` during active builds (file-lock contention, partial syncs).
2. **Space in path** — Gradle/Android NDK toolchains and several Node tools have recurring
   failures with spaces in project paths.

**Recommendation:** relocate to a short, sync-free path (e.g. `C:\dev\nutrimind`) **before
Phase 1**. This is raised as a decision item in the Phase 0 completion report; it is a
risk (R-04), not a blocker, for Phase 0 itself since Phase 0 is documentation-only.

## 4. Baseline conclusions feeding the Build Plan

1. Monorepo is created from scratch exactly as mandated: `apps/mobile`, `apps/api`,
   `packages/shared`, `supabase/`, `observability/`, `docs/`.
2. No backward-compatibility constraints exist for Phase 1 schema design — design it right the
   first time; additive-migration discipline begins at migration `0001`.
3. All external credentials/datasets are absent (expected): see `.env.example` and
   `docs/DATA_SOURCES.md` for the complete acquisition checklist. None block Phases 0–1;
   first hard external dependency lands in Phase 2 (LLM provider keys) and Phase 3
   (USDA key, IFCT dataset file).

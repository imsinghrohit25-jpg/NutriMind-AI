# ADR-0012 — Melos-Managed Dart Monorepo for Global Enterprise Edition

**Date:** 2026-07-08  
**Status:** Accepted  
**Deciders:** Principal Architect, Flutter Lead  

---

## Context

The Global Enterprise Edition requires 19 Dart packages (core, country_engine, localization_engine, food_intelligence, nutrition_rules, health_score, allergen_guardian, barcode_engine, grocery_providers, restaurant_intelligence, ocr_engine, voice_engine, recipe_engine, meal_planner, pantry_intelligence, biomarker_engine, health_data, ai_agent_layer, analytics) to be independently versioned, testable, and published to an internal pub registry.

The existing codebase has a single Flutter app (`apps/mobile`) with all logic inlined. Package extraction must preserve all existing behavior behind stable interfaces.

---

## Decision

Adopt **melos** (pub.dev/packages/melos) as the Dart monorepo management tool.

**Workspace root:** `C:\dev\nutrimind\melos.yaml`  
**Package locations:** `packages/**`, `apps/mobile`  

melos provides:
- `melos run` for parallel cross-package commands
- `melos bootstrap` for local dependency linking (overrides pub.dev)
- Version management aligned with Conventional Commits
- `melos exec` for cross-package test running in CI

---

## Alternatives Considered

| Option | Rejected Reason |
|--------|----------------|
| pub workspaces (Dart native, added in Dart 3.6) | Not yet stable for complex inter-package dependencies; melos has broader CI integration |
| Single Flutter app + local imports | Does not enforce package contracts; prevents independent versioning |
| pub.dev-published packages only | Requires external registry; blocks local-first development |

---

## Consequences

- All new logic goes into the appropriate package under `packages/`
- Existing `apps/mobile` logic is migrated phase-by-phase (not all at once in Phase 0)
- Phase 0 creates skeletons only; logic migration begins in Phase 1 (country_engine) and Phase 2 (localization_engine)
- CI must install melos before running Dart commands: `dart pub global activate melos`
- `melos.yaml` is the source of truth for package discovery

---

## Package→Logic Migration Map

| Package | Migrates From | Target Phase |
|---------|-------------|-------------|
| core | apps/mobile/lib/core/ | Phase 0 skeleton; Phase 1 bootstrap |
| country_engine | (new) | Phase 1 |
| localization_engine | apps/mobile/lib/l10n/ | Phase 2 |
| health_score | apps/api/src/engines/score/ | Phase 4 (Dart port of TS deterministic engine) |
| allergen_guardian | apps/api/src/engines/allergen/ | Phase 4 (Dart port) |
| food_intelligence | apps/api/src/datasources/ + resolution/ | Phase 3 |
| nutrition_rules | (new, consuming health_score) | Phase 4 |
| … | … | … |

# ADR-0004 — Offline-First Local Storage: Drift (SQLite)

**Status:** Accepted  
**Date:** 2026-07-07  
**Deciders:** NutriMind AI project

## Context

The app must work in airplane mode (core requirement: no scan lost due to network failure). Required:
1. Offline scan queue — store scans locally before syncing to API
2. Product cache — barcode→product mapping for offline lookup
3. Onboarding flags — consent, disclaimer, profile completion

## Decision

Use **Drift** (formerly moor) with `drift_flutter` for the SQLite connection.

## Rationale

| Concern | Drift approach |
|---|---|
| Type safety | Tables declared as Dart classes; generated DAO/query methods are typed |
| Migrations | `schemaVersion` integer + `onUpgrade` migration callbacks |
| Reactive queries | `watchSingle`, `watch` return Dart Streams; Riverpod can `watch` them |
| Testing | In-memory `NativeDatabase.memory()` for unit tests; no Android emulator needed |
| Platform | `drift_flutter` handles iOS/Android/desktop via `sqlite3_flutter_libs` |
| No network dep | Pure local SQLite; no cloud service; works offline-first by construction |

## Schema (v1)

- `local_scans` — id, barcode?, imageB64?, ocrRawText?, status (pending/synced/failed), errorMsg?, createdAt, syncedAt?
- `local_products` — barcode (PK), name, brand?, source, nutrition columns, jsonPayload (full canonical JSON), cachedAt
- `onboarding_flags` — key (PK), value

## Alternatives considered

- **Hive**: Key-value only; no relational queries; no type-safe migrations.
- **Isar**: Binary format; less interoperable; schema evolution harder.
- **SharedPreferences**: Key-value only; not suitable for scan queue.

## Consequences

- `build_runner` must run after table/DAO changes to regenerate `local_db.g.dart`
- JSON payload column (`local_products.jsonPayload`) is a denormalized escape hatch for full canonical product data — avoids column-count explosion for optional nutrition fields
- Sync engine (`sync_engine.dart`) must handle partial failure: mark per-scan success/failure, not batch

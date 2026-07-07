# ADR-0003 — State Management: Riverpod with Code Generation

**Status:** Accepted  
**Date:** 2026-07-07  
**Deciders:** NutriMind AI project

## Context

The Flutter app requires a state management solution that handles:
- Authentication state (Supabase session)
- Onboarding gates (consent, disclaimer, profile) — must block navigation
- Offline/online connectivity transitions
- Async data fetching with loading/error/data states
- Provider invalidation on flag changes (consent acceptance → router re-evaluate)

## Decision

Use **flutter_riverpod** with **riverpod_annotation + riverpod_generator** (code generation).

All providers are annotated with `@riverpod` or `@Riverpod(keepAlive: true)`, and the generated `.g.dart` files are committed (not gitignored).

## Rationale

| Concern | Riverpod approach |
|---|---|
| Compile-time safety | Providers are typed; no runtime `Provider<T>` casting |
| Testability | `ProviderContainer` lets tests override any provider without `BuildContext` |
| Async state | `AsyncValue<T>` gives `.when(loading, error, data)` — no manual state machine |
| Navigation guards | `ref.watch(authStateProvider)` in GoRouter `redirect` re-evaluates on change |
| keepAlive DB | `AppDatabase` created once, closed on `ref.onDispose` |
| Code gen | `@riverpod` generates boilerplate; refactor is a rename, not a copy-paste sweep |

## Alternatives considered

- **Provider (package)**: No code gen; easy to accidentally read wrong scope.
- **BLoC**: More boilerplate; best for complex event-driven flows we don't have.
- **setState**: Unscalable beyond 2–3 screens.

## Consequences

- Build runner must run after any provider change: `flutter pub run build_runner build --delete-conflicting-outputs`
- All `.g.dart` files committed to git (not generated at CI time to avoid Flutter SDK lock)
- keepAlive providers (AppDatabase, ApiClient) live for the app lifetime — acceptable for singletons

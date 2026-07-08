# ADR-0014 — CountryProfile as Dependency-Injected Session Spine

**Date:** 2026-07-08  
**Status:** Accepted  
**Deciders:** Principal Architect  

---

## Context

Every country-specific behaviour (allergen regime, nutrition standard, label format, food data source, currency, locale, RTL layout) must be driven by a `CountryProfile` resolved at session start — never by hardcoded `if country === 'IN'` branches scattered through the codebase.

The alternative (flag-per-feature per-country) was rejected: it compounds combinatorially and cannot be audited for completeness.

---

## Decision

1. **`CountryProfile` is the single authoritative context object** for all country-aware decisions.
2. **API side:** `CountryProfile` is resolved per request by `apps/api/src/country/plugin.ts` and attached to `request.country`. Every route that needs country context reads `request.country` — never calls the resolution chain directly.
3. **Flutter side:** `countryProfileProvider` (Riverpod `StateNotifierProvider`) resolves once at app startup and is injected into all feature providers via `ref.watch`. No widget calls the resolution chain directly.
4. **Resolution chain** (6 steps, first non-null wins):
   - API: `x-user-country` → `Accept-Language` region → `CF-IPCountry` → `x-country-code` → GLOBAL
   - Flutter: stored override → API profile `preferred_country` → SIM MCC → OS locale region → stored last-known → GLOBAL
5. **The mobile client is the authoritative resolver** for SIM MCC and stored profile. It sends its resolved country as `x-user-country` header on every API request. The API trusts this (the client is authenticated via JWT).
6. **Feature flag gate:** all resolution chain behaviour is behind `global.p1.country_engine`. When OFF, `request.country` is always `INDIA_PROFILE` — zero existing India behavior changes.

---

## Alternatives Considered

| Option | Rejected Reason |
|--------|----------------|
| Hardcode IN everywhere, add country param later | Creates tech debt that's impossible to fully eradicate |
| Pass country code string instead of full profile | Forces every consumer to re-lookup the profile; no allergen regime or standard attached |
| Resolve country lazily in each service | Race conditions; resolution happens multiple times per request; can diverge |
| Store country in JWT claims | JWT is issued by Supabase Auth; adding custom claims requires auth hook infrastructure |

---

## Consequences

- **Backward compatibility:** `global.p1.country_engine = false` (default) preserves India-only behavior. No India user is ever affected until the flag is explicitly enabled.
- **Adding a new country:** Add entry to `COUNTRY_REGISTRY` + seed a nutrition rule pack in Phase 4. No core code changes.
- **Testing:** Tests that exercise country-aware code must inject a `CountryProfile` rather than relying on runtime resolution. Use `INDIA_PROFILE` or `GLOBAL_PROFILE` as test fixtures.
- **Performance:** The flag value is cached in-memory with a 5-minute TTL. Country resolution from headers is O(1) (map lookup). No per-request DB call in steady state.

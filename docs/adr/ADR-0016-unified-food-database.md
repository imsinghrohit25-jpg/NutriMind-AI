# ADR-0016: Unified Global Food Database

**Status:** Accepted  
**Date:** 2026-07-08  
**Authors:** Engineering  
**Supersedes:** None  
**Related:** ADR-0014 (CountryProfile DI), ADR-0015 (Localization)

---

## Context

Phase 1 gave us CountryProfile on every API request. Phase 3 must use it to route food data
resolution to the most authoritative source for the user's country.

Current waterfall (Phase 0 baseline):
```
Barcode: DB cache → OpenFoodFacts → IFCT (India only) → not_found
Name:    IFCT (India) → OpenFoodFacts/India → USDA → not_found
```

The India bias (`'en:india'` filter hardcoded in `resolveByName`) is a correctness issue for
non-India users: a UK user searching "cheddar" would get India-filtered OpenFoodFacts results,
which likely return nothing rather than the CoFID record.

Global scope also introduces new authoritative data sources:
- **CoFID 2021** — UK government food composition (PHE/FSA), ~3000 items, OGL v3
- **EFSA 2021** — EU-level food composition (gated, Phase 4 ETL)
- **CIQUAL 2020** — France (Phase 4)
- **BLS 3.02** — Germany (Phase 4)
- **FSANZ 2019** — Australia/NZ (Phase 4)

---

## Decision

### 1. Country-aware waterfall (flag-gated)

A new module `resolution/country-waterfall.ts` wraps the existing waterfall:

```
Flag OFF (global.p3.unified_food_schema = false):
  Delegates to legacy waterfall.ts — byte-for-byte identical to v1.

Flag ON:
  IN:  DB cache → IFCT → OFF/India → USDA → not_found
  GB:  DB cache → CoFID (name-only) → OFF/UK → USDA → not_found
  US/CA: DB cache → OFF/region → USDA → not_found
  GLOBAL: DB cache → OFF/world → USDA → not_found
```

`CountryProfile` is read from `request.country` (Phase 1 plugin — already on every request).
No new middleware needed.

### 2. CoFID as first new regional source

CoFID is chosen as the first Phase 3 source because:
- UK is Tier-1; GB users constitute a significant addressable market
- CoFID is static (CSV/JSON download), not a live API — no rate limits, no API key
- Public domain (OGL v3) — no license complexity
- Pattern mirrors IFCT (offline loader, graceful degradation when file absent)

**CoFID loading:** `CofidLoader` follows the `IfctLoader` pattern exactly:
- Reads from `apps/api/data/cofid/cofid.json` if present
- `isAvailable()` returns false when absent — routing simply skips to next step
- No crash, no exception — graceful degradation guaranteed

### 3. Schema extension (additive, backward compat)

Two optional columns added to `products`:
- `country_codes text[] DEFAULT '{}'` — markets where product is known
- `source_region text NULL` — ISO code of the source's primary region

Both columns are optional. Existing rows are unaffected (default values). All 403 existing
TypeScript tests pass unchanged (confirmed).

### 4. Data source registry expansion

Five new rows in `data_sources`:
- `cofid_2021` (active: true)
- `efsa_2021`, `ciqual_2020`, `bls_3_02`, `fsanz_2019` (active: false — Phase 4 ETL pending)

Active=false sources are registered now so the provenance chain can reference them as soon
as Phase 4 ETL loads data; no schema change needed at Phase 4.

### 5. Dart-side: FoodIntelligenceService is a thin client

The country-aware resolution logic lives entirely on the server. The Dart service simply:
1. Sends `x-user-country: <iso>` header (already done by Phase 1 CountryProfileNotifier)
2. Receives a `CanonicalProduct` JSON response
3. Maps it to `FoodProfile` (Dart-native model)

No duplicate resolution logic on client. Server is the single source of truth.

### 6. Regional food packs (descriptor-only in Phase 3)

`RegionalFoodPack` provides the manifest for downloadable offline packs.
Actual download/install mechanics are Phase 9 (deferred components).
Defining the model in Phase 3 allows Phase 4 UI to show pack availability.

---

## Alternatives Considered

### A. Client-side resolution chain on Flutter
Rejected: Keeps two resolution implementations in sync (server + client). Server is stateful
(DB cache, IFCT/CoFID loaded in memory); client cannot replicate this correctly offline.

### B. Replace waterfall.ts with country-waterfall.ts immediately
Rejected: Would break the regression suite and violate backward compat. Wrapper pattern
(flag OFF = delegate to legacy) is safer and more auditable.

### C. Add all 5 regional databases as active in Phase 3
Rejected: ETL pipelines for EFSA/CIQUAL/BLS/FSANZ are Phase 4 work. Registering them as
inactive is forward-compatible and requires no Phase 4 migration.

---

## Consequences

**Positive:**
- UK users (`GB` CountryProfile) now get CoFID results — meaningfully correct
- All other users: zero change until flag is enabled per market
- `producted.country_codes` enables Phase 7 regional caching strategy
- Source registry is extensible — any new national DB can be added without migration

**Negative:**
- CoFID data file must be hosted at `apps/api/data/cofid/cofid.json` — deployment docs needed
- Flag OFF path still has India bias in name resolution — accepted debt, fixed when Phase 1+3 flags enabled together

---

## Acceptance Gate (Phase 3)

- [ ] TypeScript: 0 regressions with flag OFF (existing 403-test suite)
- [ ] `resolveByName('cheddar', GB, deps, FLAG_ON)` → `resolvedBy = 'cofid_2021'` when CoFID available
- [ ] `resolveByName('roti', IN, deps, FLAG_ON)` → IFCT (unchanged)
- [ ] `offClient.searchByName` called with `'en:japan'` for JP country
- [ ] Migration 0019 applies cleanly; rollback removes additions
- [ ] Dart: FoodProfile JSON round-trip; RegionalFoodPack kKnownRegionalPacks complete
- [ ] `sourcePriorityFor(india)` → IFCT first; `sourcePriorityFor(gb)` → CoFID first

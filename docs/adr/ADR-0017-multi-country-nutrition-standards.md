# ADR-0017: Multi-Country Nutrition Standard Engine

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0012 (Melos Dart monorepo), ADR-0013 (feature flags), ADR-0014 (CountryProfile DI), ADR-0016 (unified food database)

---

## Context

`apps/api/src/engines/score/engine.ts` computes the deterministic 0–100 health score using
hardcoded India-only constants (`thresholds.ts`: ICMR-NIN 2020 + FSSAI 2022 + WHO). Every
`CountryProfile` in `country/registry.ts` already declares a `nutritionStandard` id (`ICMR_NIN`,
`US_DRI`, `UK_SACN`, `EFSA`, `NHMRC`, `JP_DRI`, `HPB_SG`, `WHO`) — Phase 1 anticipated this work
but no threshold data backs those ids yet. A UK product is scored today with FSSAI thresholds
regardless of the user's country.

`computeHealthScore` currently has **no production caller** — it is a standalone, fully-tested
pure function (100 tests, all passing before this change) awaiting integration into the
ingestion/scan pipeline. This bounds the scope of Phase 4 cleanly: make the engine
multi-standard-*capable* now; wiring `request.country` through to a specific call site is
future work for whichever phase builds that pipeline, exactly as CoFID-adjacent EFSA/CIQUAL/
BLS/FSANZ sources were registered inactive in Phase 3 pending their own ETL phase.

---

## Decision

### 1. `CountryNutritionStandard` as an additive, optional parameter

`computeHealthScore(input, standard?: CountryNutritionStandard)`. Omitting `standard` is
byte-identical to pre-Phase-4 behavior — confirmed by the full pre-existing regression suite
(`engine.regression.test.ts`, 11 golden tests) passing unchanged, plus a new explicit assertion
that passing `INDIA_STANDARD` reproduces the default result exactly.

Each of the six subscore functions (`scoreSodium`, `scoreSugar`, `scoreSatFat`, `scoreTransFat`,
`scoreFibre`, `scoreProtein`) gained an optional trailing `thresholds` parameter defaulting to
its existing `thresholds.ts` constant — the same wrapper pattern used for
`country-waterfall.ts` in ADR-0016 (flag/param absent → legacy behavior, unchanged).

### 2. `standards/` registry — one pack per `NutritionStandard` id

```
apps/api/src/engines/score/standards/
  types.ts     — CountryNutritionStandard, NutrientThresholdPack, ScoringWeights (pre-existing)
  india.ts     — ICMR_NIN (pre-existing; ported 1:1 from thresholds.ts)
  us.ts        — US_DRI    (US, CA)
  uk.ts        — UK_SACN   (GB)
  eu.ts        — EFSA      (DE, FR, IT, ES, NL)
  au.ts        — NHMRC     (AU)
  jp.ts        — JP_DRI    (JP)
  sg.ts        — HPB_SG    (SG)
  who.ts       — WHO       (GLOBAL fallback + all other Tier-2 countries)
  registry.ts  — STANDARD_REGISTRY map + getNutritionStandard(id) with WHO fallback
```

Adding a new country's standard is additive: create a pack file, register it in
`STANDARD_REGISTRY`, point the `CountryProfile.nutritionStandard` field at its id. No engine or
subscore code changes, matching the "no core code changes" promise already made for countries in
ADR-0014.

`registry.ts` calls `assertWeightsSum()` on every pack at module load — a malformed weight set
(doesn't sum to 1.0) fails at import time, not silently at runtime.

### 3. Sourcing and approximation methodology

Every standard's per-100g/100kcal bands are simplified to the same five-bucket shape
(`veryLow`/`low`/`moderate`/`high`/`veryHigh`, four-bucket for trans fat) already established by
`india.ts` — itself an approximation blending ICMR-NIN, WHO, and FSSAI rather than a literal
reproduction of FSSAI's full category-specific claim system. The same approach is applied here:
real regulatory anchor points are used where a country publishes simple per-100g cut-offs (UK FSA
traffic light green/red; Japan CAA "no"/"low" claim values; US FDA Daily Values; Singapore
Nutri-Grade A–D bands); intermediate/extreme bands are linearly interpolated/extrapolated from
those anchors. Full multi-variable algorithms (Nutri-Score's point tables, Australia's Health
Star Rating baseline-points-by-category, WHO's Europe NPM per-category thresholds) are **not**
reproduced exactly — they are not reducible to a single universal per-100g table, and doing so
would misrepresent them as more precise than this pack's granularity supports. Each pack file's
header comment cites its specific sources and states this explicitly. See
`docs/COUNTRY_NUTRITION_STANDARDS.md` for the full per-country citation table.

This is a lower-confidence area than the India pack (which had a prior session's direct
regulatory citation work behind it) and should be revisited with a licensed nutrition-policy
review before any of these standards is used to drive a real per-country score shown to users
(gated behind `global.p4.multi_standard_rules`, currently `false`).

### 4. Scope boundary for this phase

`supabase/migrations/0017_feature_flags.sql` already seeded four Phase 4 flags:
`multi_standard_rules`, `life_stage_rules`, `condition_rules`, `allergen_regime_map`. Only
`multi_standard_rules` is implemented by this change. `life_stage_rules` (age/pregnancy-adjusted
thresholds), `condition_rules` (diabetes/hypertension overlays), and `allergen_regime_map`
(per-country FDA-9/EU-14/JP-8 allergen detection — distinct from nutrition scoring) are deferred,
mirroring the EFSA/CIQUAL/BLS/FSANZ "registered inactive" precedent from ADR-0016.

### 5. Dart: `nutrition_rules` is a thin metadata client, not a duplicate engine

`packages/nutrition_rules/` exposes `NutritionStandardId` + display metadata
(`displayName`, `authority`) for showing "why this score" context in the UI, resolved from a
`CountryProfile`. It does **not** reimplement the scoring math. Score computation stays
server-side and single-source-of-truth — there is currently no client caller of
`computeHealthScore` at all (see Context), so a duplicate Dart implementation would only be a
second thing to keep in sync with zero present benefit. The ADR-0012 migration map's "health_score
(Dart port)" is deferred until the ingestion pipeline needs offline scoring; this package
prepares the client-side vocabulary for that without committing to the duplication yet.

---

## Alternatives Considered

### A. Hardcode a `switch (countryCode)` in `engine.ts`
Rejected: exactly the anti-pattern ADR-0014 already rejected for allergen/standard dispatch —
combinatorial, unauditable, and bypasses the `CountryProfile` spine.

### B. Store thresholds in the database (`nutrition_standards` table) instead of code
Rejected for this phase: thresholds are versioned, reviewed constants (like `thresholds.ts`
today), not user- or tenant-mutable data. A DB table adds a runtime dependency and audit-trail
complexity for no present benefit — `feature_flags` already provides the kill switch. Revisit if
a future phase needs live threshold tuning without a deploy.

### C. Full Dart reimplementation of the scoring engine now
Rejected — see Decision §5. Premature given zero current client callers.

### D. Reproduce Nutri-Score/HSR/WHO-NPM algorithms exactly (full point tables, per-category rules)
Rejected for this phase: each is a materially more complex multi-variable model than this
engine's five-bucket-per-nutrient shape supports. Approximating with cited anchor points (§3) is
transparent about its own limits; silently claiming exact replication would not be.

---

## Consequences

**Positive:**
- `computeHealthScore` is now capable of country-aware scoring with zero behavior change for
  existing (implicit India) callers — all 440 existing API tests pass unchanged.
- Adding an 8th, 9th, ... country standard is a pure-addition change (new file + registry entry).
- `assertWeightsSum` at module load catches a malformed pack before it ships, not in production.

**Negative:**
- Seven of the eight packs (all but India) are approximations built from partial public
  documentation in a single research pass, not a full licensed regulatory review — flagged in §3
  and in `docs/COUNTRY_NUTRITION_STANDARDS.md`. Must not be treated as medical/regulatory advice
  (existing medical-disclaimer policy already covers this, but the approximation is a distinct,
  additional caveat worth naming explicitly).
- No route or worker yet passes a resolved `CountryProfile`-derived standard into
  `computeHealthScore` — this ADR makes the engine capable, not the product country-aware
  end-to-end. That wiring is scoped to whichever phase builds/revisits the scoring call site.
- `life_stage_rules`, `condition_rules`, `allergen_regime_map` remain unimplemented (§4).

---

## Acceptance Gate (Phase 4)

- [x] TypeScript: 0 regressions with `standard` omitted (existing 440-test suite passes unchanged)
- [x] `computeHealthScore(input, INDIA_STANDARD)` exactly matches `computeHealthScore(input)`
- [x] All 8 `NutritionStandard` ids referenced by `country/registry.ts` resolve to a registered pack
- [x] Every pack's weights sum to 1.0 (enforced at module load, asserted in tests)
- [x] Every pack's thresholds are monotonically increasing per nutrient
- [x] `getNutritionStandard()` falls back to `WHO_STANDARD` for unknown/missing ids
- [ ] Licensed nutrition-policy review of non-India packs before `global.p4.multi_standard_rules` is enabled for any real user

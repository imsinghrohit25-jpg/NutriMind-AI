# ADR-0018: Grocery & Restaurant Intelligence (Phase 5)

**Status:** Accepted
**Date:** 2026-07-08
**Authors:** Engineering
**Supersedes:** None
**Related:** ADR-0014 (CountryProfile DI), ADR-0016 (unified food database), ADR-0017 (multi-country nutrition standards)

---

## Context

Two India-only, hardcoded subsystems predate the Global Enterprise Edition: `grocery-optimizer.ts`
(a single INR price/category table used to price shopping lists generated from meal plans) and
`recipe-generator.ts` / `menu-scanner.ts` (India-cuisine-only LLM prompts, with a per-gram
nutrient-density table for estimating recipe ingredient nutrition). `supabase/migrations/0017_
feature_flags.sql` seeded three Phase 5 flags: `global.p5.grocery_provider_chain`,
`global.p5.restaurant_etl`, `global.p5.estimated_nutrition_label`. As with Phase 3
(EFSA/CIQUAL/BLS/FSANZ registered inactive) and Phase 4 (`life_stage_rules`/`condition_rules`/
`allergen_regime_map` deferred), this phase implements what real, groundable data or reusable
project patterns support now, and explicitly defers what would otherwise require fabricating
data.

---

## Decision

### 1. `grocery_provider_chain` — implemented

`apps/api/src/planner/grocery-providers/` follows the exact registry pattern from ADR-0017's
`standards/`: `types.ts` (`GroceryPriceProvider` interface), one file per provider
(`india.ts` — an exact port of the pre-Phase-5 table, preserving default behavior;
`us.ts`, `uk.ts` — new, approximate market-average prices), and `registry.ts`
(`getGroceryProvider(isoCode)`, falling back to the India provider — matching the pre-Phase-5
default, same as `ADR-0017`'s WHO fallback pattern but anchored to the actual legacy behavior
here since there was no prior "global" pricing default).

`buildGroceryList(recipes, provider?)` gained an optional trailing parameter; omitting it (or
passing `INDIA_GROCERY_PROVIDER` explicitly) is byte-identical to pre-Phase-5 behavior — asserted
directly in `grocery-optimizer.test.ts`.

**Schema change:** `grocery_items.estimated_rs` (India-only, INR-implied) was renamed to
`estimated_price` and a `currency_code` column was added (migration `0020_grocery_currency`).
Unlike ADR-0016/0017's purely additive migrations, this is a straight rename — the project has
no production data yet (pre-launch, per every prior Phase Completion Report), so layering a
second, parallel column would only be debt with no compatibility benefit. `planner.ts` (API
route) and `grocery_list_screen.dart` (mobile UI, currency-symbol-mapped for INR/USD/GBP with a
graceful fallback to the raw code) were updated to match.

**Known scope gap:** recipes are still generated exclusively in Indian cuisine
(`recipe-generator.ts`'s prompt is hardcoded "Indian recipe generator"). US/UK grocery providers
therefore price the same Indian-ingredient vocabulary (dal, atta, paneer, ghee, ...) against
US/UK markets rather than pricing a US/UK-appropriate shopping list. This is intentionally
correct scope for *this* phase (pricing pluggability) — recipe/cuisine localization is a
separate, larger effort not undertaken here.

### 2. `restaurant_etl` — deferred (interface + graceful degradation only)

`apps/api/src/restaurant/chain-loader.ts` mirrors `CofidLoader` exactly: reads an offline
dataset from `apps/api/data/restaurant-chains/chains.json` when present, returns
"not available" (never throws, never fabricates a chain's nutrition data) when absent — which is
the case today, since no licensed/public restaurant-chain nutrition dataset has been acquired.
This registers the interface `menu-scanner.ts` and future callers can code against, without
inventing plausible-looking numbers for real restaurant chains and their real menu items, which
would be a materially different (and worse) integrity problem than the grocery table's "approximate
market average" framing (ADR-0017 §3 draws the same distinction between official regulatory
constants and volatile market estimates — restaurant-chain nutrition is closer to the former:
specific, factual, and wrong if guessed).

### 3. `estimated_nutrition_label` — implemented

The per-gram nutrient-density estimation logic already used by `recipe-generator.ts` (LLM
identifies ingredient names/quantities; a deterministic density table computes the actual
calorie/macro numbers — the same "LLM identifies, engine computes" policy used throughout this
project, e.g. ADR-0007's added-sugar estimation) is extracted into a shared module,
`apps/api/src/nutrition/density-estimator.ts`. `recipe-generator.ts` now imports from it
(behavior-preserving refactor — same table, same rounding, same fallback).

`menu-scanner.ts` gains `estimateMenuItemNutrition(item)`, which applies the same density
estimator to a menu item's LLM-identified ingredients, spread across a category-based portion-
size heuristic (e.g. "main" ≈ 350g, "dessert" ≈ 120g). The result always carries
`isEstimated: true` and a low `confidence` (0.15–0.35) — this is a rough per-portion
approximation, never presented as a measured value. Wired additively into the
`/api/v1/restaurant/menu/scan` response as a new `nutritionEstimate` field on each scored item
(purely additive JSON key — does not change any existing field, so no flag gate was needed for
this particular wiring, unlike `computeHealthScore`'s country parameter in ADR-0017 which changes
existing output).

---

## Alternatives Considered

### A. Fabricate a restaurant-chain nutrition dataset now to fully implement `restaurant_etl`
Rejected: this is exactly the kind of specific, factual, checkable claim ("Chain X's Item Y has
Z calories") that the project's zero-mocks/real-data-only policy exists to prevent. The
`CofidLoader`-style graceful-degradation interface is the correct shape to ship without the data.

### B. Keep grocery pricing India-only until recipes are also localized
Rejected: pricing pluggability and recipe/cuisine localization are separable concerns. Shipping
the provider chain now (with the scope gap named explicitly in §1) is still real, tested,
additive progress, and unblocks recipe localization from needing to also solve pricing later.

### C. Preserve `estimated_rs` alongside a new generic column (purely additive, ADR-0016-style)
Rejected here specifically: with zero production rows in this pre-launch project, a rename is
strictly cleaner than a permanent duplicate column. (This does not change the general preference
for additive migrations once real user data exists — see ADR-0016 §3.)

---

## Consequences

**Positive:**
- Grocery pricing is now pluggable per country with zero behavior change for existing (implicit
  India) callers — all 472 existing/updated API tests pass.
- `estimateMenuItemNutrition` reuses proven, already-tested density-estimation logic rather than
  introducing a second numeric-estimation code path.
- `RestaurantChainLoader`'s interface lets a real dataset be dropped in later with zero call-site
  changes, once one is licensed/acquired.

**Negative:**
- US/UK grocery pricing is only meaningfully useful once recipe generation is also localized
  (§1 scope gap).
- `restaurant_etl` remains non-functional (by design) until a real chain dataset exists — no
  timeline is set for acquiring one.
- No route currently resolves `request.country` into a `GroceryPriceProvider` automatically —
  `buildGroceryList()`'s `provider` parameter must be passed explicitly by a future caller, same
  "engine capable, not yet wired end-to-end" gap noted for `computeHealthScore` in ADR-0017.

---

## Acceptance Gate (Phase 5)

- [x] TypeScript: 0 regressions with `provider` omitted from `buildGroceryList()` (472-test suite passes)
- [x] `buildGroceryList(recipes, INDIA_GROCERY_PROVIDER)` exactly matches `buildGroceryList(recipes)`
- [x] `getGroceryProvider()` falls back to the India provider for unregistered/null/undefined countries
- [x] `RestaurantChainLoader.isAvailable()` is `false` and every lookup gracefully returns empty/null with no dataset installed
- [x] `estimateMenuItemNutrition()` always returns `isEstimated: true` with confidence ≤ 0.5
- [x] Migration 0020 applies cleanly; rollback restores `estimated_rs` and drops `currency_code`
- [ ] Restaurant chain dataset acquisition (blocks `restaurant_etl` becoming functional — no owner/timeline yet)
- [ ] Recipe/cuisine localization (blocks non-India grocery providers being practically useful — future phase)

# Grocery & Restaurant Intelligence — Phase 5 Reference

**Effective:** 2026-07-08 · **Phase:** 5 (Global Enterprise Edition)
**Flags:** `global.p5.grocery_provider_chain`, `global.p5.restaurant_etl` (non-functional, deferred), `global.p5.estimated_nutrition_label`
**Related:** [ADR-0018](adr/ADR-0018-grocery-restaurant-intelligence.md), [COUNTRY_NUTRITION_STANDARDS.md](COUNTRY_NUTRITION_STANDARDS.md) (the equivalent reference for Phase 4)

## Grocery price providers

| Provider id | Country | Currency | Rounding | Source basis |
|---|---|---|---|---|
| `in_retail_avg` | IN | INR | whole rupee | Exact port of the pre-Phase-5 table — approximate retail average |
| `us_retail_avg` | US | USD | 2 decimals | BLS Average Retail Food Prices / USDA Food Price Outlook (2026) for potatoes; standard-shelf-price ballparks otherwise |
| `uk_retail_avg` | GB | GBP | 2 decimals | 2026 UK supermarket price surveys for potato/carrot/rice/cheese/milk/chicken; ballparks otherwise |

None of these are live pricing feeds — they are budgeting estimates, same caveat the original
India table already carried. **Recipes are still India-cuisine-only** (`recipe-generator.ts`), so
non-India providers price the same Indian-ingredient vocabulary against a different market — a
named, tracked scope gap (ADR-0018 §1), not an oversight.

## Restaurant chain nutrition ETL — deferred

`RestaurantChainLoader` (`apps/api/src/restaurant/chain-loader.ts`) is ready to load
`apps/api/data/restaurant-chains/chains.json` if a licensed/public dataset is ever placed there
(e.g. US chains' NLEA-mandated menu-labeling disclosures). No such dataset exists yet — this is
intentionally left non-functional rather than populated with fabricated per-item nutrition
numbers for real restaurant chains, which the project's real-data-only policy does not permit.

## Estimated nutrition labels

`estimateMenuItemNutrition()` (`apps/api/src/restaurant/menu-scanner.ts`) reuses the same
per-gram density table as recipe generation (`apps/api/src/nutrition/density-estimator.ts`).
Every result carries `isEstimated: true` and a `confidence` ≤ 0.35 — client UIs consuming this
(via `nutrimind_restaurant_intelligence`'s `MenuNutritionEstimate.isLowConfidence`) should
visually mark it as a rough estimate, never as a measured value.

## Known gaps (tracked, not blocking Phase 5)

- No route resolves `request.country` into a `GroceryPriceProvider` automatically yet —
  `buildGroceryList()`'s `provider` parameter must be passed explicitly (same "capable, not yet
  wired end-to-end" pattern as `computeHealthScore` in ADR-0017).
- `restaurant_etl` has no dataset, owner, or timeline.
- Recipe/cuisine generation is not yet localized — a prerequisite for non-India grocery providers
  to be practically useful.

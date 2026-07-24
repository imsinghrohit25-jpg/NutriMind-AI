# ADR-0038: Premium Redesign — Home Screen Real-Data Cards

## Status
Accepted (Phase 2).

## Context
Phase 2 asks for "floating nutrient summary cards" showing real recent-scan data, with an
explicit carve-out: "If the user has no scan history yet, show a designed empty state — an empty
state is NOT fake data." The existing Home screen had no stat/summary cards at all — just a
static list of navigation cards.

## Decision
1. **Real data source, no new backend call.** Two new read-only query methods on the existing
   `AppDatabase` (`recentProducts()`, `scansTodayCount()`), wrapped in two new `@riverpod`
   providers (`recentScannedProductsProvider`, `scansTodayProvider`). Both read straight from the
   on-device Drift cache (`LocalProducts`/`LocalScans`, populated by the existing scan pipeline) —
   no schema change, no network round-trip, no invented numbers.
2. **No fabricated "health score" ring.** The deterministic Health Score Engine's output isn't
   persisted into `LocalProducts` today (only raw per-100g macros are cached) and there's no
   mobile-callable endpoint to recompute one for a cached product without a fresh network
   resolve. Rather than invent a number, the "last scanned product" card's `AnimatedNutrientRing`
   shows real cached energyKcal against the standard "2000 kcal reference diet" — the same
   %DV convention already printed on every nutrition facts panel worldwide (and matching the
   FSSAI/USDA-style label convention this app's own Product screen already assumes elsewhere) —
   labeled explicitly as a reference, not a personalized target.
3. **Empty state, not zero-filled fake data.** Zero cached products → a designed "scan your first
   product" prompt with the same scan CTA, not a card showing "0 kcal" as if that were real.
4. **AI presence tied to real signal.** `NutriMindLogo` stays `idle` by default; it only
   transitions to `celebrating` when `scansToday > 0` (a real fact — the user actually scanned
   something today), never based on an invented "good day" heuristic.
5. **All existing entry-point cards preserved verbatim** (Scan barcode, Scan nutrition label,
   Snap a meal, Household, Diet Chat, Diet Plan) — same routes, same `onTap` — restyled onto
   `GlassCard`/`GradientScaffold` with staggered `flutter_animate` entrances, not rebuilt.

## Consequences
- Home's new stat cards degrade gracefully offline (same local-cache read either way) and for
  brand-new users (empty state) — no loading spinner ever blocks the primary scan CTA.
- If a future phase adds a persisted/recomputable Health Score for cached products, the ring
  swaps to the real score with a one-line change (the widget already accepts an arbitrary
  value/max pair); today's 2000-kcal-reference framing is a deliberate, disclosed interim choice,
  not left ambiguous.

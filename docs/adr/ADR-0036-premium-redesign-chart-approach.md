# ADR-0036: Premium Redesign — Chart / Data-Visualization Approach

## Status
Accepted (Phase 0 decision; `fl_chart` usage itself begins in Phase 3).

## Context
The redesign needs two distinct kinds of data visualization: (1) a single hero metric shown as an
animated circular progress ring (the Health Score, and similar single-value/max-value metrics),
and (2) multi-value nutrient breakdowns (per-100g macros as bars, a week of intake as a line
chart) with axes, labels, and potentially tooltips.

## Decision
Split by which tool actually earns its weight for the job:

- **Single-value ring (Health Score, budget-remaining rings, etc.) → hand-written `CustomPainter`**
  (`AnimatedNutrientRing`, `lib/core/design_system/components/nutrient_ring.dart`). A ring is one
  arc; a general-purpose chart library adds API surface (legends, axis config, tooltip
  controllers) this use case doesn't need, for a component that also needs an exact,
  signature-look animation curve tied to `AppMotion` tokens — easier to get pixel-perfect with a
  direct `Canvas.drawArc` than by fighting a library's own animation model.
- **Multi-value nutrient bars/lines (Phase 3's nutrient breakdown, later trend charts) →
  `fl_chart: ^1.2.0`** (pub.dev-verified current stable, 2026-07-13). These genuinely need
  axes, multiple series, and consistent styling across several different chart shapes (bar, line,
  radar) — reimplementing that in raw `CustomPainter` would be reinventing a mature,
  well-maintained library for no real benefit. `fl_chart` is added to `pubspec.yaml` in Phase 0
  so it's available when Phase 3 needs it, but has zero call sites until then (no unused-feature
  risk — the dependency is real and will be exercised immediately in the next phase, not sitting
  speculative).

## Consequences
- Two different technical approaches to "a chart" is intentional, not an inconsistency — each is
  the right tool for what it's actually rendering. The design-system component boundary
  (`AnimatedNutrientRing` vs. future `fl_chart`-based components) is where this split lives, so
  screens never choose between the two themselves.
- All chart *values* (ring fill, bar heights) must be real, already-computed numbers passed in by
  the caller (e.g. the deterministic Health Score Engine's output) — no chart component computes
  or estimates a number itself, matching the app's existing "Agents orchestrate and explain.
  Engines compute" discipline extended to the presentation layer.

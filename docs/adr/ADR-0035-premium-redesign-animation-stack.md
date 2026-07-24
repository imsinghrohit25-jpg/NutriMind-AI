# ADR-0035: Premium Redesign — Animation Stack & AI Avatar

## Status
Accepted (Phase 0), with one honest, documented gap (AI avatar implementation — see below).

## Context
The redesign brief calls for: a motion/choreography library for staggered entrances and
transitions, and a Rive-preferred (Lottie-acceptable) state-machine-driven "AI presence" avatar
plus premium loaders, with an explicit rule against any placeholder/mock asset.

## Decision

### Choreography: `flutter_animate: ^4.5.2`
Verified current stable on pub.dev (2026-07-13). Chosen over hand-rolling every staggered
entrance with raw `AnimationController`s: its declarative `.animate().fadeIn().slideY()`-style API
is what most of the later phases' card/list staggering will use, keeping choreography code terse
and consistent. Motion durations/curves still come from `AppMotion` (tokens.dart) — the package
provides the mechanism, not the values.

### AI avatar & premium loaders: hand-coded Flutter widgets, NOT Rive
The brief's preferred implementation is a Rive state-machine animation authored as a `.riv`
binary asset in the Rive editor. **This environment has no Rive-editor / design-tool access to
author a genuine one.** A placeholder or empty `.riv` file would directly violate the redesign's
own "zero placeholder assets, zero fake data" non-negotiable — so rather than fake it, the
decision is:

`NutriMindLogo` (`lib/core/design_system/components/nutrimind_logo.dart`) is a fully-coded,
production-real `AnimationController`-driven widget expressing the same four states the brief
asks for (`idle`, `listening`, `thinking`, `celebrating`) via scale/glow changes on a gradient
orb — no face, no eyes, deliberately abstract so it stays legally distinct from any benchmarked
product's mascot. `ShimmerSkeleton` (loaders) is similarly hand-coded, not Lottie.

This is real, shippable, production code — not a stub — it simply uses a different *technique*
(Flutter's own animation framework) than the brief's first preference. If a real `.riv` asset is
supplied later (by a designer with Rive-editor access), it is a **drop-in swap** behind the same
widget interface (`NutriMindLogo`'s public API — `size`, `state`) — later phases building on top
of it (Phase 2's dynamic AI presence, Phase 4's chat avatar) do not need to change.

`rive: ^0.14.9` was version-verified on pub.dev in case this swap happens later, but is
**not added to `pubspec.yaml` in Phase 0** — no unused dependency for an asset that doesn't exist.

### Charts: see ADR-0036 (kept separate — different tradeoff, `fl_chart` vs `CustomPainter`).

## Consequences
- `AnimationPolicy`/`AnimationPolicyBuilder` (new, `animation_policy.dart`) is the single place
  every looping component (the logo, `ShimmerSkeleton`, later phases' floating cards) checks
  reduced-motion + app-foreground state before animating — written once in Phase 0 so no later
  phase needs to re-derive this logic per-widget.
- Every `AnimationController` created by a design-system component disposes itself in `dispose()`
  (verified by reading each file) — the memory/battery non-negotiable applies from Phase 0 onward,
  not just Phase 5's audit pass.

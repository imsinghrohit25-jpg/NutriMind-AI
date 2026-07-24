# ADR-0041: Premium Redesign — Phase 5 (Global Polish), Increment 1: Haptics + Governance-to-Zero

## Status
Accepted (Phase 5, increment 1). Phase 5 is multi-increment; this ADR covers the central haptic
service and the governance-violation cleanup. Theme toggle/persistence, the loader sweep, app
icon/splash, and the WCAG AA audit are subsequent increments (see Consequences → Remaining).

## Context
Phase 5 (Global Polish) is the redesign's final sweep. Phase 0's audit left 39 known
`check-design-governance.ts` violations (raw `TextStyle(fontSize:)` and raw `Duration(...)`) in
pre-existing screens, explicitly deferred to Phase 5. Separately, haptics were called ad hoc via
`HapticFeedback.*` from 5 screens with no central control and no semantic naming.

## Decision

1. **Central `HapticService`** (`core/design_system/haptic_service.dart`) — a plain static utility
   (like `AppMotion`/`AppFonts`; a haptic is a fire-and-forget side effect with no observable
   state). Semantic methods (`light`/`medium`/`heavy`/`selection` + `success`/`warning`/`error`
   aliases), a global `enabled` switch (for a future settings toggle to mute all haptics), and
   optional `context` that suppresses haptics under OS reduce-motion. All 5 existing call sites
   (login/register error shake, app-intro page change, product allergen hard-gate, scanner
   lock-on) now route through it. Each site's original impact intensity is preserved; the allergen
   safety haptic stays ungated (fires even under reduce-motion — it is a safety signal). Covered by
   3 new unit tests spying on the real platform haptic channel.

2. **Governance to zero (39 → 0)**, in three moves:
   - **Animation durations → `AppMotion` tokens** (5 sites): off-grid values snapped to the nearest
     tier (250/300 → `standard`, 200 → `micro`, 500 → `cinematic`). Consistency is the whole point
     of the token system; the sub-50ms timing shifts are cosmetic, not behavioral.
   - **Typography → `AppType` scale** (22 sites): raw `TextStyle(fontSize:)` replaced with
     `AppType.<token>` (or `.copyWith(color/fontWeight/fontFamily:)` to preserve intent). `copyWith`
     is used deliberately — it also lets off-scale sizes (10/13) and the monospace lab-report style
     map onto a token without re-introducing a `fontSize` literal. `const` was dropped on widgets
     whose style became non-const.
   - **Functional `Duration`s exempted, not tokenized** (9 sites): network timeouts, the scanner
     resolve-cooldown/detection-throttle, router redirect timers, and a UX settle-delay are not
     animations and must not be forced into `AppMotion`. Rather than silently path-excluding those
     files (which would blind the gate to future real violations there), the governance script gains
     an **inline `// design-governance:ignore: <reason>` directive** — an auditable, per-line opt-out.
     Each exemption carries a reason.

## Consequences
- `scripts/check-design-governance.ts` now PASSES (78 files, 0 violations) and stays a meaningful
  CI gate — the ignore directive is narrow (single line) and reasoned, not a blanket exclusion.
- Every haptic in the app is now mutable via one switch and reduce-motion-aware where a context is
  available — a real accessibility gain over the prior always-fire behavior.
- Gate: `flutter analyze` 0 issues; `flutter test` 39/39 (36 prior + 3 new haptic tests); governance
  0 violations. No backend/logic files changed; `api_client.dart`'s only edit is two trailing
  governance-ignore comments (non-behavioral) on its network timeouts.
- **Remaining Phase 5 increments (not in this ADR):** (a) dark/light theme toggle + persistence +
  wiring `buildDarkTheme()` — gated on migrating ~50 screens' direct `AppColors.*` references to a
  brightness-aware source so dark mode isn't half-broken (light text on dark surfaces); (b) replace
  the 37 raw `CircularProgressIndicator`s with a branded `AppLoader` (note: the 11 on-button
  `color: Colors.white` spinners are already correct and theme-agnostic); (c) production app icon +
  splash; (d) WCAG AA contrast audit of both palettes.

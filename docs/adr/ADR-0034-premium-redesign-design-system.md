# ADR-0034: Premium Redesign — Design System Extension & Typography

## Status
Accepted (Phase 0 of the premium 3D cinematic UI/UX redesign).

## Context
The redesign brief assumes a fresh `lib/design_system/` directory. A real, working design system
already exists at `apps/mobile/lib/core/design_system/` (`tokens.dart` — `AppColors`,
`AppSpacing`, `AppType`, `scoreColor()` — and `theme.dart` — `buildLightTheme()`), consumed by
~50 existing screens. A separate, already-committed premium glass UI kit also exists at
`features/auth/widgets/auth_ui.dart` (`GlassCard`, `PrimaryButton`, `SecondaryButton`,
`AuthScaffold`, `ShakeTransition`, `StatusBanner`, etc.) from prior work on the login/register
screens — not yet promoted to a shared location.

## Decision
1. **Extend, don't replace.** All new tokens (`AppColorsDark`, `AppGlass`, `AppElevation`,
   `AppMotion`, `AppFonts`) are added to the existing `tokens.dart` file, additive only — every
   pre-existing exported name (`AppColors.*`, `AppSpacing.*`, `AppType.*`, `scoreColor()`) is
   untouched and still used by every existing screen without modification.
2. **Promote, don't fork.** `GlassCard`, `PrimaryButton`, and `SecondaryButton` are moved
   (behavior-preserving — same public API, same visual constants) from
   `features/auth/widgets/auth_ui.dart` into `lib/core/design_system/components/`.
   `auth_ui.dart` re-exports them (`export '...components/glass_card.dart';` etc.) so every
   existing auth-screen import keeps compiling with zero changes. This satisfies the redesign's
   own "no duplicated UI components" governance rule — a second `GlassCard` would have been a
   more severe violation than editing one file outside `design_system/`.
3. **Typography**: Sora (display: headlines, large numbers, the Health Score) + Inter (body/
   label — extremely legible, tabular figures available for animated numbers), both via
   `google_fonts: ^8.1.0` (pub.dev-verified 2026-07-13). Chosen over Manrope + Source Sans 3 for a
   more confident, slightly "fintech-premium" character that reads distinctly from Apple Health's
   San Francisco, WHOOP's proprietary face, and Oura's system font — satisfying the redesign's
   legal/brand-distinctness requirement by construction (an open-license pairing neither
   benchmark uses).
4. **Dark theme**: `buildDarkTheme()` added alongside `buildLightTheme()`, same structural shape,
   driven token-for-token by a new `AppColorsDark` palette so the two can't drift out of sync via
   ad hoc per-screen dark-mode patches. Score-band and veg-mark colors are NOT reinterpreted per
   theme (kept from `AppColors` directly) since they carry regulatory/food-safety meaning that
   must not shift with brightness.
5. **App-wide dark-mode switching (`MaterialApp.darkTheme`/`themeMode`, persisted user
   preference) is explicitly deferred to Phase 5** per the redesign roadmap — Phase 0 only needed
   to prove both themes render correctly, which the debug-only `DesignSystemGalleryScreen` does.

## Consequences
- `apps/mobile/lib/features/auth/widgets/auth_ui.dart` is the one file outside
  `lib/core/design_system/`, `docs/`, and `pubspec.yaml`/`pubspec.lock` touched in Phase 0 — a
  deliberate, documented exception to the "zero changes outside design_system" gate criterion,
  justified by avoiding a duplicate-component violation instead.
- `AppGlass`'s blur sigma / opacity constants were tuned to match the original auth-screen
  `GlassCard` exactly (sigma 20, fill 0.14, border 0.25 in dark) so promoting it doesn't shift the
  already-shipped, already-tested login/register screens' appearance.

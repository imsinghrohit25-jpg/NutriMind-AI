# ADR-0042: Premium Redesign — Phase 5, Increment 2: Full Dark/Light Theming

## Status
Accepted (Phase 5, increment 2). Follows ADR-0041 (haptics + governance).

## Context
`buildDarkTheme()` existed since Phase 0 but was never wired: `app.dart` only set `theme:`.
Worse, ~50 screens referenced the static light-only `AppColors.*` directly (367 references across
56 files), so merely flipping `themeMode` would have rendered light-coloured text/surfaces on dark
backgrounds. A real dark mode required making those colour references resolve per active theme.

## Decision

1. **`AppPalette` `ThemeExtension`** (`core/design_system/app_palette.dart`) carries the 16 tokens
   that legitimately differ between light and dark (neutrals `background/surface/surfaceVariant/
   onBackground/onSurface/subtle/divider`, brand `primary*/accent*`, semantic `success/warning/
   error/info`). `AppPalette.light` is sourced token-for-token from `AppColors` (so light mode is
   byte-identical to before); `AppPalette.dark` from `AppColorsDark`. Both are registered via
   `ThemeData.extensions`. Screens read `context.colors.<token>`.
   - **Deliberately NOT in the palette (stay static `AppColors`):** health-score bands
     (`scoreExcellent…scoreBad`) and veg marks — they carry regulatory/food-safety meaning and must
     not shift between themes. Also left static by intent: the branded logo/auth/intro gradients
     (brand identity) and the scan-frame overlay (drawn over a live camera feed, not a themed
     surface). `GradientScaffold` and `ShimmerSkeleton` were already brightness-aware.

2. **Migration** of all 272 per-brightness references in `features/` (plus the migratable
   design-system components: `nutrient_bar`, `nutrient_ring`, `typing_indicator`, `buttons`, the
   gallery) from `AppColors.X` → `context.colors.X`. Where a widget was `const` and now holds a
   runtime colour, `const` was dropped; a few context-less getters (`_color`, `_bubbleColor`) took
   a `BuildContext` parameter; two component default-colour params became nullable with a
   `?? context.colors.…` fallback so they resolve at build time.

3. **Wiring + persistence**: `themeModeProvider` (a plain `NotifierProvider`, no codegen) holds
   `ThemeMode`, persisted **device-globally** (not per-user — theme belongs to the install and must
   apply pre-login) via new `AppDatabase.get/setGlobalFlag` (a `global:` namespace in the existing
   KV table). `app.dart` now sets `theme` + `darkTheme` + `themeMode`. A toggle lives in the Home
   AppBar (auto → dark → light), cycling with a selection haptic.

## Consequences
- Every screen resolves colours through the active theme; light mode is unchanged, dark mode is a
  real, tuned palette (not an inversion). The choice persists across launches and account switches.
- **Contrast is machine-verified**, not eyeballed: `test/core/design_system/app_palette_test.dart`
  asserts WCAG relative-luminance contrast ≥ 4.5:1 for body text (`onSurface`/`onBackground` on their
  surfaces) and ≥ 3:1 for the secondary `subtle` tone (used at large/label sizes) in BOTH palettes,
  and proves `context.colors` resolves to the light vs dark palette under the respective theme.
- Gate: `flutter analyze` 0 issues; `flutter test` 49/49 (39 prior + 10 new palette/contrast);
  `check-design-governance` 0 violations. No backend/logic files touched.
- **Remaining Phase 5:** branded `AppLoader` (replace 37 `CircularProgressIndicator`s), production
  app icon + splash. Dark/light theming itself is complete.

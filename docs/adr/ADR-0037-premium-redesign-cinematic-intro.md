# ADR-0037: Premium Redesign — Cinematic Pre-Auth Intro Carousel

## Status
Accepted (Phase 1).

## Context
Phase 1 requires a "cinematic onboarding" — a 3-4 screen, skippable, shown-once value-prop
carousel with a brand moment, staggered entrances, parallax, and a page indicator. This is
distinct from the app's existing mandatory `/onboarding/*` routes (consent, disclaimer, country,
language, profile-setup), which are functional data-collection gates that run AFTER sign-up/
sign-in and cannot be skipped. Phase 0's audit also found that `login`/`register`/forgot-password
are already a fully-built premium glass experience (`AuthScaffold`, `GlassCard`, `PrimaryButton`,
animated error shake, loading-morph buttons, honest OAuth-not-configured states) — so Phase 1's
real net-new work is this carousel, not rebuilding auth screens that are already premium.

## Decision
1. New route `AppRoutes.intro` (`/intro`), new screen `AppIntroScreen`
   (`features/onboarding/screens/app_intro_screen.dart`), 4 slides: brand moment (animated
   `NutriMindLogo`) + 3 value props (barcode scanning across global databases, AI diet chat,
   family allergen guardian).
2. **Shown-once persistence**: a new `appIntroSeenProvider` (`core/offline/local_db.dart`) reads/
   writes flag key `app_intro_v1` via the existing generic `OnboardingFlags` key/value table — no
   schema change, no new table. Deliberately NOT scoped to a signed-in user (unlike
   `OnboardingState`'s consent/disclaimer/etc flags) since it must be checked before any sign-in
   exists; `AppDatabase._scopedKey` already falls back to the unprefixed key when
   `auth.currentUser` is null, which is exactly correct here.
3. **Router integration** (`core/router/router.dart`): a new redirect branch, checked BEFORE the
   existing auth guard: if the user is unauthenticated, hasn't seen the intro, and isn't already
   on `/intro` or a directly-deep-linked `/login`/`/register` (so a shared login link never gets
   trapped behind the carousel), redirect to `/intro`. Skip/complete on the last slide calls
   `setFlag('app_intro_v1', 'true')` then navigates to `/login`.
4. **Motion**: staggered slide-content entrance via `flutter_animate` (its first real call site —
   ADR-0035 added the dependency in Phase 0 with no consumer yet), a parallax background icon
   that scrolls at 0.4x the foreground's swipe speed (computed from `PageController`'s page
   fraction, not a separate gesture), `HapticFeedback.selectionClick()` on page settle, and a
   custom animated dot indicator — all durations/curves from `AppMotion` (no raw `Duration(...)`
   in the new screen).

## Consequences
- Zero auth/session logic touched — this is a new, self-contained screen + one new provider + one
  new router branch. `Supabase.instance.client.auth.*` is never called by this screen.
- The existing `login_screen.dart`/`register_screen.dart` gain one small, real gap-fix identified
  during audit: `HapticFeedback.mediumImpact()` added alongside the existing shake animation on
  validation/auth error (the brief's "shake + haptic on invalid submit" was only half-implemented
  — shake existed, haptic didn't).

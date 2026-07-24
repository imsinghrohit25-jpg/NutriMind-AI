# NutriMind Motion Language (ADR-0035)

Single source of truth for animation timing/easing. Every duration/curve below is a named
constant in `lib/core/design_system/tokens.dart`'s `AppMotion`; no screen may write a raw
`Duration(milliseconds: ...)` for an animation (governance grep check — see
`scripts/check-design-governance.ts`).

## Duration tiers

| Tier | Duration | Token | Use for |
|---|---|---|---|
| Micro | 150ms | `AppMotion.micro` | press states, toggles, checkbox/chip selection |
| Standard | 300ms | `AppMotion.standard` | page element entrances, card fades, list item reveal |
| Cinematic | 600ms | `AppMotion.cinematic` | hero moments — Health Score ring fill, onboarding page transitions, splash → home handoff |

## Easing

One signature curve family, used everywhere for consistency (not a different curve per screen):

- **Enter** — `Curves.easeOutCubic` (`AppMotion.enter`): anything appearing/growing.
- **Exit** — `Curves.easeInCubic` (`AppMotion.exit`): anything leaving/shrinking.
- **Emphasized** — `Curves.easeOutBack` (`AppMotion.emphasized`): used *sparingly* — success
  celebrations, a button's press-release settle. Overuse reads as bouncy/unprofessional, not premium.

## Choreography rules

- **Staggered entrances**: successive cards/list items delay by `AppMotion.staggerStep` (60ms)
  each — a 4-card grid finishes its stagger in ~240ms, well inside the "standard" tier ceiling so
  the whole entrance still feels like one connected moment, not a slow reveal.
- **Shared-element continuity**: use `Hero` for a card → its detail screen transition (e.g. a
  nutrient card → Product Result, once Phase 2/3 build them) — the same visual object should
  visibly travel, not cross-fade into an unrelated new layout.
- **Page transitions**: `PageTransitionsTheme` (see `theme.dart`) applies
  `FadeForwardsPageTransitionsBuilder` on Android and `CupertinoPageTransitionsBuilder` on iOS
  app-wide — iOS's native edge-swipe-back gesture is preserved because the Cupertino builder is
  exactly what provides it; this must never be overridden per-route.

## Reduced-motion fallback

Every ambient/looping animation (idle "breathing" logo, floating card, shimmer sweep) must
consult `AnimationPolicyBuilder` (`lib/core/design_system/animation_policy.dart`), which reports
`shouldAnimate = false` when:
- `MediaQuery.of(context).disableAnimations` is true (OS-level reduce-motion), or
- the app is not in the foreground (`AppLifecycleState != resumed`).

When `shouldAnimate` is false, components must land on a settled, still frame — not simply stop
mid-motion, and never remove the content/information the animation was conveying (e.g. the
Health Score ring still shows the full, correct arc; it just doesn't animate the fill-in).

One-shot animations (entrance fades, button press feedback, page transitions) are NOT gated by
`AnimationPolicyBuilder` — Flutter's own `MediaQuery.disableAnimations` already shortens/removes
transition animations at the framework level for those, and a one-shot animation completing
instantly is not a battery/performance concern the way an infinite loop is.

## Known gap

There is no first-class, reliable cross-platform Flutter API to query OS battery-saver mode
directly (Android's `Battery Saver` / iOS's `Low Power Mode`) without a platform channel of
uncertain accuracy across OEM skins. `AnimationPolicy` does not attempt to detect it. If this
becomes a real requirement, add a platform channel behind a feature flag rather than guessing.

## Glassmorphism performance budget

`BackdropFilter` (used by `GlassCard`) is one of the most expensive widgets in Flutter's
rendering pipeline. Rules, enforced by review (not yet mechanically, see gap below):
- Max 2-3 active blurred `GlassCard` instances visible on screen at once.
- Never use the blurred `GlassCard` constructor inside a scrolling list's repeated item builder
  on mid-range hardware — use `GlassCard.static` (pre-baked translucent fill, no blur) there.
- Measure every new glass-heavy screen with Flutter DevTools' performance overlay before
  considering it done.

**Known gap**: a mechanical (grep/lint) check that *counts* `GlassCard(` (blurred) instances per
screen file doesn't exist yet — Phase 0's governance script checks for raw style/color/duration
violations only. Adding a per-file blur-instance counter is a reasonable Phase 5 addition once
more screens actually use `GlassCard` and a real budget-violation pattern would be visible.

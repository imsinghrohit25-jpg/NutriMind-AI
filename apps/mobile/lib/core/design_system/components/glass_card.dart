import 'dart:ui';

import 'package:flutter/material.dart';

import '../tokens.dart';

/// Frosted-glass card: translucent fill + backdrop blur + soft border — the base surface every
/// glass panel in the app sits on. Promoted from `features/auth/widgets/auth_ui.dart`'s original
/// GlassCard (ADR-0034) into the shared design system so Home/Scanner/Chat (later redesign
/// phases) reuse the exact same component instead of forking a second one — `auth_ui.dart` now
/// re-exports this file so every existing auth-screen call site keeps compiling unchanged.
///
/// Perf budget (docs/design/MOTION.md): `BackdropFilter` is one of Flutter's most expensive
/// effects — max 2-3 active instances per screen, and never inside a scrolling list item on
/// mid-range hardware (use [GlassCard.static] there instead, a pre-baked translucent fill with
/// no blur, visually close at a fraction of the GPU cost).
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.xl),
    this.borderRadius = 28,
  }) : _blurred = true;

  /// No-blur variant for scrolling list items / repeated cards — see perf budget above.
  const GlassCard.static({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.xl),
    this.borderRadius = 28,
  }) : _blurred = false;

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final bool _blurred;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final decoratedChild = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppGlass.fill(brightness),
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: AppGlass.border(brightness)),
      ),
      child: child,
    );

    if (!_blurred) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: decoratedChild,
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: AppGlass.blurSigma, sigmaY: AppGlass.blurSigma),
        child: decoratedChild,
      ),
    );
  }
}

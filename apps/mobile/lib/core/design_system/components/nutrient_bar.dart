import 'package:flutter/material.dart';

import '../animation_policy.dart';
import '../app_palette.dart';
import '../tokens.dart';

/// Animated horizontal nutrient bar — one row of a nutrition table showing a real per-100g value
/// against a standard %DV-style reference (the caller computes [fraction]; this widget only
/// animates and paints it, never invents the reference itself).
class NutrientBar extends StatelessWidget {
  const NutrientBar({
    super.key,
    required this.label,
    required this.valueText,
    required this.fraction,
    this.color,
    this.highlight = false,
    this.indent = false,
  });

  final String label;
  final String valueText;
  /// 0.0–1.0+ (values over the reference are clamped visually but the raw number still prints).
  final double fraction;
  /// Bar fill colour; defaults to the theme's primary (`context.colors.primary`) when null.
  final Color? color;
  final bool highlight;
  final bool indent;

  @override
  Widget build(BuildContext context) {
    final barColor = color ?? context.colors.primary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (indent) const SizedBox(width: AppSpacing.l),
              Expanded(child: Text(label, style: highlight ? AppType.titleSmall : AppType.bodySmall)),
              Text(
                valueText,
                style: (highlight ? AppType.titleSmall : AppType.bodySmall)
                    .copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Padding(
            padding: EdgeInsets.only(left: indent ? AppSpacing.l : 0),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: SizedBox(
                height: highlight ? 6 : 4,
                child: AnimationPolicyBuilder(
                  builder: (context, shouldAnimate) => TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: fraction.clamp(0.0, 1.0)),
                    duration: shouldAnimate ? AppMotion.cinematic : Duration.zero,
                    curve: AppMotion.enter,
                    builder: (context, animatedFraction, _) => LinearProgressIndicator(
                      value: animatedFraction,
                      backgroundColor: barColor.withAlpha(20),
                      color: barColor,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

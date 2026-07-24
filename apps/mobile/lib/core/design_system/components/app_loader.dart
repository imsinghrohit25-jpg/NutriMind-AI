import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../animation_policy.dart';
import '../app_palette.dart';
import '../tokens.dart';

/// Branded loading indicator (Phase 5 — Global Polish). Replaces the app's bare
/// `CircularProgressIndicator`s with a single premium affordance: a gradient arc sweeping in the
/// brand primary, theme-aware (colour from `context.colors.primary` by default) and
/// [AnimationPolicyBuilder]-driven so it goes static under OS reduce-motion / when backgrounded
/// (memory & battery non-negotiable, Phase 0). On-button white spinners are intentionally left as
/// plain `CircularProgressIndicator(color: Colors.white)` — a solid white ring reads better on a
/// filled CTA than a gradient arc.
class AppLoader extends StatefulWidget {
  const AppLoader({
    super.key,
    this.size = 28,
    this.color,
    this.strokeWidth = 3,
    this.label,
  });

  final double size;

  /// Arc colour; defaults to the theme's primary (`context.colors.primary`).
  final Color? color;
  final double strokeWidth;

  /// Optional caption rendered under the spinner (e.g. "Resolving product…").
  final String? label;

  /// Convenience full-bleed centered loader for whole-screen loading states.
  static Widget centered({double size = 32, String? label}) =>
      Center(child: AppLoader(size: size, label: label));

  @override
  State<AppLoader> createState() => _AppLoaderState();
}

class _AppLoaderState extends State<AppLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? context.colors.primary;

    final spinner = AnimationPolicyBuilder(
      builder: (context, shouldAnimate) {
        if (shouldAnimate && !_controller.isAnimating) {
          _controller.repeat();
        } else if (!shouldAnimate && _controller.isAnimating) {
          _controller.stop();
        }
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: shouldAnimate
              ? AnimatedBuilder(
                  animation: _controller,
                  builder: (_, __) => CustomPaint(
                    painter: _ArcPainter(
                      color: color,
                      turns: _controller.value,
                      strokeWidth: widget.strokeWidth,
                    ),
                  ),
                )
              // Reduced-motion / backgrounded: a static three-quarter ring — still an unmistakable
              // "busy" affordance, just not spinning.
              : CustomPaint(
                  painter: _ArcPainter(
                    color: color,
                    turns: 0,
                    strokeWidth: widget.strokeWidth,
                  ),
                ),
        );
      },
    );

    if (widget.label == null) return spinner;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        spinner,
        const SizedBox(height: AppSpacing.m),
        Text(
          widget.label!,
          textAlign: TextAlign.center,
          style: AppType.bodySmall.copyWith(color: context.colors.subtle),
        ),
      ],
    );
  }
}

class _ArcPainter extends CustomPainter {
  _ArcPainter({required this.color, required this.turns, required this.strokeWidth});

  final Color color;
  final double turns; // 0..1 rotation
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = (math.min(size.width, size.height) - strokeWidth) / 2;

    // Faint full track underneath for a premium, grounded look.
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = color.withValues(alpha: 0.12);
    canvas.drawCircle(center, radius, track);

    // The sweeping arc: a gradient from transparent to full colour, rotated by `turns`.
    const sweep = math.pi * 1.5; // 270°
    final startAngle = turns * 2 * math.pi;
    final shader = SweepGradient(
      startAngle: 0,
      endAngle: sweep,
      colors: [color.withValues(alpha: 0.0), color],
      transform: GradientRotation(startAngle),
    ).createShader(Rect.fromCircle(center: center, radius: radius));

    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = strokeWidth
      ..shader = shader;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweep,
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(_ArcPainter old) =>
      old.turns != turns || old.color != color || old.strokeWidth != strokeWidth;
}

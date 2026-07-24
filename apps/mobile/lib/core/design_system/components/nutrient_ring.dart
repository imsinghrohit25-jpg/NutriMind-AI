import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../animation_policy.dart';
import '../app_palette.dart';
import '../tokens.dart';

/// Animated circular progress ring — used for the Health Score hero moment (Phase 3) and any
/// other single-value-out-of-max metric. Custom-painted rather than a chart-library widget
/// (ADR-0036: fl_chart is for the bar/line nutrient charts where axes/legends/tooltips earn
/// their dependency weight; a single ring is simpler and cheaper as a `CustomPainter`, and gives
/// exact control over the signature look).
///
/// The animation is PRESENTATION ONLY: [value] must be a real, already-computed number (e.g. the
/// deterministic Health Score Engine's output) — this widget never computes or estimates one.
class AnimatedNutrientRing extends StatefulWidget {
  const AnimatedNutrientRing({
    super.key,
    required this.value,
    required this.maxValue,
    required this.color,
    this.size = 140,
    this.strokeWidth = 12,
    this.label,
    this.centerBuilder,
  });

  /// The real value to display (e.g. Health Score 0-100, or grams-consumed-of-target).
  final double value;
  final double maxValue;
  final Color color;
  final double size;
  final double strokeWidth;
  final String? label;
  /// Optional custom center content; defaults to `value.round()` as large tabular-figure text.
  final WidgetBuilder? centerBuilder;

  @override
  State<AnimatedNutrientRing> createState() => _AnimatedNutrientRingState();
}

class _AnimatedNutrientRingState extends State<AnimatedNutrientRing> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: AppMotion.cinematic);
    _progress = _buildTween().animate(CurvedAnimation(parent: _controller, curve: AppMotion.enter));
  }

  Tween<double> _buildTween() => Tween<double>(
        begin: 0,
        end: widget.maxValue > 0 ? (widget.value / widget.maxValue).clamp(0.0, 1.0) : 0.0,
      );

  @override
  void didUpdateWidget(covariant AnimatedNutrientRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value || oldWidget.maxValue != widget.maxValue) {
      _progress = _buildTween().animate(CurvedAnimation(parent: _controller, curve: AppMotion.enter));
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimationPolicyBuilder(
      builder: (context, shouldAnimate) {
        if (shouldAnimate && _controller.status == AnimationStatus.dismissed) {
          _controller.forward();
        } else if (!shouldAnimate && _controller.status != AnimationStatus.completed) {
          // Reduced-motion / backgrounded: jump straight to the end state, never stuck at 0.
          _controller.value = 1;
        }
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: AnimatedBuilder(
            animation: _progress,
            builder: (context, _) {
              return CustomPaint(
                painter: _RingPainter(
                  progress: _progress.value,
                  color: widget.color,
                  trackColor: widget.color.withValues(alpha: 0.15),
                  strokeWidth: widget.strokeWidth,
                ),
                child: Center(
                  // progress.value ranges 0 -> (value/maxValue), so multiplying back by maxValue
                  // gives 0 -> value: the displayed number counts up in lockstep with the arc.
                  child: widget.centerBuilder?.call(context) ?? _DefaultCenter(
                    displayValue: _progress.value * widget.maxValue,
                    label: widget.label,
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _DefaultCenter extends StatelessWidget {
  const _DefaultCenter({required this.displayValue, this.label});
  final double displayValue;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          displayValue.isFinite ? displayValue.round().toString() : '—',
          style: AppType.displayMedium.copyWith(
            fontFeatures: const [FontFeature.tabularFigures()],
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
        if (label != null)
          Text(label!, style: AppType.labelSmall.copyWith(color: context.colors.subtle)),
      ],
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color, required this.trackColor, required this.strokeWidth});
  final double progress;
  final Color color;
  final Color trackColor;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - strokeWidth) / 2;

    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, trackPaint);

    final progressPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    const startAngle = -math.pi / 2;
    final sweepAngle = 2 * math.pi * progress;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.color != color;
}

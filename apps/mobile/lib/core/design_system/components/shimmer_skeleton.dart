import 'package:flutter/material.dart';

import '../animation_policy.dart';
import '../tokens.dart';

/// Shimmering placeholder block for async regions — replaces bare `CircularProgressIndicator`s
/// on user-facing surfaces (Phase 5 non-negotiable) with a shape-matched skeleton so the layout
/// doesn't jump when real content arrives. Pauses its sweep entirely under reduced-motion /
/// backgrounded (via [AnimationPolicyBuilder]) rather than continuing to animate invisibly.
class ShimmerSkeleton extends StatefulWidget {
  const ShimmerSkeleton({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = AppSpacing.chipRadius,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  State<ShimmerSkeleton> createState() => _ShimmerSkeletonState();
}

class _ShimmerSkeletonState extends State<ShimmerSkeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final base = brightness == Brightness.dark ? AppColorsDark.surfaceVariant : AppColors.surfaceVariant;
    final highlight = brightness == Brightness.dark ? AppColorsDark.divider : Colors.white;

    return AnimationPolicyBuilder(
      builder: (context, shouldAnimate) {
        if (shouldAnimate) {
          if (!_controller.isAnimating) _controller.repeat();
        } else {
          if (_controller.isAnimating) _controller.stop();
        }
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return ClipRRect(
              borderRadius: BorderRadius.circular(widget.borderRadius),
              child: SizedBox(
                width: widget.width,
                height: widget.height,
                child: DecoratedBox(
                  // _controller.stop() (above) freezes .value at whatever point the sweep was at —
                  // that's the actual pause; no need to special-case shouldAnimate here too.
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment(-1 + 2 * _controller.value, 0),
                      end: Alignment(1 + 2 * _controller.value, 0),
                      colors: [base, highlight, base],
                      stops: const [0.35, 0.5, 0.65],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

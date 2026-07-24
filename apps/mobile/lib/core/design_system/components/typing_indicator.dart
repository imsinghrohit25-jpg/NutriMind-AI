import 'package:flutter/material.dart';

import '../animation_policy.dart';
import '../app_palette.dart';

/// "Assistant is composing" indicator — three dots pulsing in sequence. Reusable anywhere a
/// streaming/thinking wait needs a real, non-generic affordance (first use: AI Diet Chat, Phase
/// 4), never a bare `CircularProgressIndicator`.
class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key, this.color, this.dotSize = 8});

  /// Dot colour; defaults to the theme's subtle tone (`context.colors.subtle`) when null.
  final Color? color;
  final double dotSize;

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dotColor = widget.color ?? context.colors.subtle;
    return AnimationPolicyBuilder(
      builder: (context, shouldAnimate) {
        if (shouldAnimate && !_controller.isAnimating) {
          _controller.repeat();
        } else if (!shouldAnimate && _controller.isAnimating) {
          _controller.stop();
        }
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return SizedBox(
              height: widget.dotSize * 2,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(3, (i) {
                  // Each dot's bounce is offset by a third of the cycle from the last.
                  final t = (_controller.value - (i * 0.2)) % 1.0;
                  final bounce = shouldAnimate ? (1 - (2 * t - 1).abs()).clamp(0.0, 1.0) : 0.0;
                  return Padding(
                    padding: EdgeInsets.symmetric(horizontal: widget.dotSize * 0.25),
                    child: Transform.translate(
                      offset: Offset(0, -bounce * widget.dotSize * 0.6),
                      child: Container(
                        width: widget.dotSize,
                        height: widget.dotSize,
                        decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                      ),
                    ),
                  );
                }),
              ),
            );
          },
        );
      },
    );
  }
}

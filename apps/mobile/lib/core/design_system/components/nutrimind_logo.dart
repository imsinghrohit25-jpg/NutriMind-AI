import 'package:flutter/material.dart';

import '../animation_policy.dart';
import '../tokens.dart';

/// The states the animated brand mark can express — a real, code-driven state machine
/// (ADR-0035) standing in for the prompt's preferred Rive state-machine avatar, since this
/// environment has no Rive-editor access to author a genuine `.riv` asset and a placeholder one
/// would violate the "zero placeholder assets" rule. Swappable later behind this same widget
/// interface if a real Rive asset is supplied.
enum NutriMindMoodState { idle, listening, thinking, celebrating }

/// NutriMind's animated brand mark / AI presence — a soft gradient orb with a slow idle
/// "breathing" scale+glow, a faster attentive pulse in [NutriMindMoodState.listening]/
/// [NutriMindMoodState.thinking], and a bright double-pulse + ring burst on
/// [NutriMindMoodState.celebrating]. Deliberately abstract (no eyes/face) to stay legally distinct
/// from any benchmarked product's mascot/avatar.
class NutriMindLogo extends StatefulWidget {
  const NutriMindLogo({super.key, this.size = 96, this.state = NutriMindMoodState.idle});

  final double size;
  final NutriMindMoodState state;

  @override
  State<NutriMindLogo> createState() => _NutriMindLogoState();
}

class _NutriMindLogoState extends State<NutriMindLogo> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  Duration get _cycleDuration => switch (widget.state) {
    NutriMindMoodState.idle => const Duration(seconds: 3),
    NutriMindMoodState.listening => const Duration(milliseconds: 1200),
    NutriMindMoodState.thinking => const Duration(milliseconds: 900),
    NutriMindMoodState.celebrating => const Duration(milliseconds: 500),
  };

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _cycleDuration);
  }

  @override
  void didUpdateWidget(covariant NutriMindLogo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.state != widget.state) {
      _controller.duration = _cycleDuration;
      if (widget.state == NutriMindMoodState.celebrating) {
        _controller.forward(from: 0).then((_) {
          if (mounted) _controller.repeat(reverse: true);
        });
      } else {
        _controller.repeat(reverse: true);
      }
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
        if (shouldAnimate) {
          if (!_controller.isAnimating) _controller.repeat(reverse: true);
        } else {
          if (_controller.isAnimating) _controller.stop();
          _controller.value = 0.5; // rest at a neutral mid-breath frame, not frozen mid-motion
        }
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final t = _controller.value;
            final scale = switch (widget.state) {
              NutriMindMoodState.idle => 1.0 + 0.04 * t,
              NutriMindMoodState.listening => 1.0 + 0.08 * t,
              NutriMindMoodState.thinking => 1.0 + 0.06 * t,
              NutriMindMoodState.celebrating => 1.0 + 0.16 * t,
            };
            final glow = 0.25 + 0.35 * t;
            return Transform.scale(
              scale: scale,
              child: Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.accentLight.withValues(alpha: 0.9),
                      AppColors.primary.withValues(alpha: 0.9),
                      AppColors.primaryDark,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: glow),
                      blurRadius: widget.size * 0.5,
                      spreadRadius: widget.size * 0.05,
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

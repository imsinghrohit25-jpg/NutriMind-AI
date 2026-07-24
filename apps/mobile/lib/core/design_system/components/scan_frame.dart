import 'package:flutter/material.dart';

import '../animation_policy.dart';
import '../tokens.dart';

/// Cinematic scanner viewfinder overlay — animated corner brackets with a sweeping scan laser,
/// and a brief "lock-on" glow the instant a barcode is detected. Pure presentation over the
/// camera preview; the caller (ScannerScreen) still owns all detection/capture logic untouched —
/// this widget only reacts to [locked], it never decides when something is detected.
class ScanFrameOverlay extends StatefulWidget {
  const ScanFrameOverlay({
    super.key,
    this.width = 260,
    this.height = 160,
    this.locked = false,
    this.showLaser = true,
  });

  final double width;
  final double height;
  /// True for a brief moment right after a successful detection — brackets snap to full size and
  /// glow the success color instead of idly sweeping.
  final bool locked;
  /// False for label/meal modes (no live laser sweep — single still capture, not continuous scan).
  final bool showLaser;

  @override
  State<ScanFrameOverlay> createState() => _ScanFrameOverlayState();
}

class _ScanFrameOverlayState extends State<ScanFrameOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _laserController;

  @override
  void initState() {
    super.initState();
    _laserController = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _laserController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.locked ? AppColors.scoreExcellent : AppColors.primary;
    return AnimationPolicyBuilder(
      builder: (context, shouldAnimate) {
        if (shouldAnimate && !_laserController.isAnimating) {
          _laserController.repeat(reverse: true);
        } else if (!shouldAnimate && _laserController.isAnimating) {
          _laserController.stop();
        }
        return AnimatedScale(
          scale: widget.locked ? 1.06 : 1.0,
          duration: AppMotion.micro,
          curve: AppMotion.emphasized,
          child: SizedBox(
            width: widget.width,
            height: widget.height,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Sweeping laser line — clipped to the frame's interior, paused when reduced
                // motion / backgrounded, or hidden entirely for single-still capture modes.
                if (widget.showLaser && !widget.locked)
                  ClipRect(
                    child: AnimatedBuilder(
                      animation: _laserController,
                      builder: (context, _) => Align(
                        alignment: Alignment(0, -1 + 2 * _laserController.value),
                        child: Container(
                          height: 2,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [color.withAlpha(0), color, color.withAlpha(0)],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ..._corners(color),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _corners(Color color) {
    const len = 28.0;
    const thick = 3.0;
    Widget corner({required bool top, required bool left}) {
      return Positioned(
        top: top ? -thick / 2 : null,
        bottom: top ? null : -thick / 2,
        left: left ? -thick / 2 : null,
        right: left ? null : -thick / 2,
        child: AnimatedContainer(
          duration: AppMotion.standard,
          width: len,
          height: len,
          decoration: BoxDecoration(
            border: Border(
              top: top ? BorderSide(color: color, width: thick) : BorderSide.none,
              bottom: !top ? BorderSide(color: color, width: thick) : BorderSide.none,
              left: left ? BorderSide(color: color, width: thick) : BorderSide.none,
              right: !left ? BorderSide(color: color, width: thick) : BorderSide.none,
            ),
            borderRadius: BorderRadius.only(
              topLeft: top && left ? const Radius.circular(8) : Radius.zero,
              topRight: top && !left ? const Radius.circular(8) : Radius.zero,
              bottomLeft: !top && left ? const Radius.circular(8) : Radius.zero,
              bottomRight: !top && !left ? const Radius.circular(8) : Radius.zero,
            ),
          ),
        ),
      );
    }

    return [
      corner(top: true, left: true),
      corner(top: true, left: false),
      corner(top: false, left: true),
      corner(top: false, left: false),
    ];
  }
}

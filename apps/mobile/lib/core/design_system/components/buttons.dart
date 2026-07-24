import 'package:flutter/material.dart';

import '../app_palette.dart';
import '../tokens.dart';

/// The primary call-to-action — a gradient-filled pill button with a smooth loading crossfade
/// and a press micro-interaction (scale down 3% on tap-down). Promoted from
/// `features/auth/widgets/auth_ui.dart` (ADR-0034) into the shared design system — see that
/// file's re-export comment. Kept deliberately generic (label/loading/disabled/onPressed) so it
/// works identically wherever a primary action button is needed, not just in auth.
class PrimaryButton extends StatefulWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.loading,
    required this.disabled,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final bool disabled;
  final VoidCallback onPressed;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  double _scale = 1;

  @override
  Widget build(BuildContext context) {
    final enabled = !widget.disabled;
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _scale = 0.97) : null,
      onTapUp: enabled ? (_) => setState(() => _scale = 1) : null,
      onTapCancel: enabled ? () => setState(() => _scale = 1) : null,
      onTap: enabled ? widget.onPressed : null,
      child: AnimatedScale(
        scale: _scale,
        duration: AppMotion.micro,
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: LinearGradient(
              colors: enabled ? [context.colors.accent, context.colors.accentLight] : [Colors.grey, Colors.grey.shade400],
            ),
            boxShadow: enabled
                ? [BoxShadow(color: context.colors.accent.withValues(alpha: 0.45), blurRadius: 18, offset: const Offset(0, 8))]
                : [],
          ),
          alignment: Alignment.center,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: widget.loading
                ? const SizedBox(
                    key: ValueKey('loading'),
                    height: 22, width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                  )
                : Text(
                    widget.label,
                    key: const ValueKey('label'),
                    style: AppType.labelLarge.copyWith(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                  ),
          ),
        ),
      ),
    );
  }
}

/// Secondary CTA — glass-outlined rather than solid-filled, so it reads as premium but doesn't
/// visually compete with a [PrimaryButton] on the same screen. Promoted alongside it (see above).
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.loading,
    required this.disabled,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final bool disabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = !disabled;
    return SizedBox(
      height: 54,
      child: OutlinedButton(
        onPressed: enabled ? onPressed : null,
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: BorderSide(color: Colors.white.withValues(alpha: enabled ? 0.7 : 0.3)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: loading
              ? const SizedBox(
                  key: ValueKey('loading'), height: 20, width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                )
              : Text(label, key: const ValueKey('label'), style: AppType.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }
}

import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';

// Premium redesign (ADR-0034): GlassCard/PrimaryButton/SecondaryButton used to be defined
// locally in this file. They've been promoted, unchanged in behavior, to
// `core/design_system/components/` so later-phase screens (Home, Scanner, Chat) reuse the exact
// same components instead of forking a second glass card / button — the redesign's own
// "no duplicated UI components" governance rule applies to this file same as any other.
// Re-exporting keeps every existing `import '.../auth_ui.dart'` call site (login_screen.dart,
// register_screen.dart) compiling with zero changes.
export '../../../core/design_system/components/glass_card.dart';
export '../../../core/design_system/components/buttons.dart';

/// Shared premium auth UI kit — extracted from the original LoginScreen redesign so RegisterScreen
/// (and any future auth-adjacent screen) reuses the exact same look rather than duplicating it.

/// Full-screen gradient background + scrollable, entrance-animated card container. Every auth
/// screen (login, register, ...) wraps its form in this so they all feel like one experience.
class AuthScaffold extends StatefulWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.card,
    this.showIllustration = true,
    this.leading,
  });

  final String title;
  final String subtitle;
  final Widget card;
  final bool showIllustration;
  /// Optional widget shown above the title (e.g. a back button row) — kept outside the
  /// entrance-animated column so it's immediately tappable, not faded in.
  final Widget? leading;

  @override
  State<AuthScaffold> createState() => _AuthScaffoldState();
}

class _AuthScaffoldState extends State<AuthScaffold> with TickerProviderStateMixin {
  late final AnimationController _entranceController;
  late final Animation<double> _entranceFade;
  late final Animation<Offset> _entranceSlide;
  late final AnimationController _floatController;
  late final Animation<double> _floatOffset;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(vsync: this, duration: AppMotion.cinematic);
    _entranceFade = CurvedAnimation(parent: _entranceController, curve: Curves.easeOut);
    _entranceSlide = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entranceController, curve: Curves.easeOutCubic));
    _entranceController.forward();

    _floatController = AnimationController(vsync: this, duration: AppMotion.ambient)
      ..repeat(reverse: true);
    _floatOffset = Tween<double>(begin: -8, end: 8)
        .animate(CurvedAnimation(parent: _floatController, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _entranceController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primaryDark, AppColors.primary, AppColors.primaryLight],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.xl, AppSpacing.l, AppSpacing.xl, AppSpacing.xl + bottomInset,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight - AppSpacing.xl * 2),
                  child: IntrinsicHeight(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (widget.leading != null) widget.leading!,
                        FadeTransition(
                          opacity: _entranceFade,
                          child: SlideTransition(
                            position: _entranceSlide,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 440),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (widget.showIllustration) ...[
                                    Center(
                                      child: AnimatedBuilder(
                                        animation: _floatOffset,
                                        builder: (context, child) => Transform.translate(
                                          offset: Offset(0, _floatOffset.value),
                                          child: child,
                                        ),
                                        child: const FoodIllustration(),
                                      ),
                                    ),
                                    const SizedBox(height: AppSpacing.xl),
                                  ],
                                  Text(
                                    widget.title,
                                    textAlign: TextAlign.center,
                                    style: AppType.displayMedium.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    widget.subtitle,
                                    textAlign: TextAlign.center,
                                    style: AppType.bodyLarge.copyWith(color: Colors.white.withValues(alpha: 0.85)),
                                  ),
                                  const SizedBox(height: AppSpacing.xxl),
                                  widget.card,
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// A soft glass circle with a small cluster of food emoji — a zero-asset "illustration" since
/// this project has no bundled image assets (assets/images/ is empty). Deliberately avoids any
/// third-party logo/trademark; these are plain Unicode glyphs.
class FoodIllustration extends StatelessWidget {
  const FoodIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 112,
      height: 112,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white.withValues(alpha: 0.28), Colors.white.withValues(alpha: 0.08)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.5),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 24, offset: const Offset(0, 12)),
        ],
      ),
      alignment: Alignment.center,
      child: const Text('🥗🍎🥑', style: AppType.displayLarge),
    );
  }
}

class AuthTextField extends StatelessWidget {
  const AuthTextField({
    super.key,
    required this.controller,
    required this.label,
    required this.icon,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
    this.suffixIcon,
    this.validator,
    this.readOnly = false,
    this.onTap,
    this.inputFormatters,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final bool readOnly;
  final VoidCallback? onTap;
  final List<TextInputFormatter>? inputFormatters;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onFieldSubmitted: onSubmitted,
      validator: validator,
      readOnly: readOnly,
      onTap: onTap,
      inputFormatters: inputFormatters,
      style: const TextStyle(color: Colors.white),
      cursorColor: Colors.white,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.75)),
        prefixIcon: Icon(icon, color: Colors.white.withValues(alpha: 0.8)),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.12),
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.l, vertical: AppSpacing.m),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: Colors.white, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: BorderSide(color: context.colors.accentLight, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: BorderSide(color: context.colors.accentLight, width: 1.5),
        ),
        errorStyle: const TextStyle(color: Colors.white),
      ),
    );
  }
}

enum SocialButtonStatus { ready, loading, notConfigured }

/// Social sign-in button with a third state beyond ready/loading: `notConfigured`, shown instead
/// of a button that would just fail silently when the OAuth provider isn't enabled in Supabase —
/// a real, honest status rather than a dead button pretending to work.
class SocialButton extends StatelessWidget {
  const SocialButton({
    super.key,
    required this.label,
    required this.status,
    required this.leading,
    required this.onPressed,
  });

  final String label;
  final SocialButtonStatus status;
  final Widget leading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    if (status == SocialButtonStatus.notConfigured) {
      return Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.l),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.info_outline_rounded, size: 18, color: Colors.white.withValues(alpha: 0.5)),
            const SizedBox(width: AppSpacing.s),
            Flexible(
              child: Text(
                '$label — not yet set up',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      );
    }

    final loading = status == SocialButtonStatus.loading;
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white.withValues(alpha: 0.1),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: loading
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  leading,
                  const SizedBox(width: AppSpacing.m),
                  Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ],
              ),
      ),
    );
  }
}

/// A plain, non-trademarked "G" glyph — deliberately not Google's official multi-color logo
/// (that requires their branded asset per Google's sign-in button guidelines). Swap this for
/// the official asset when wiring up real Google OAuth credentials.
class GoogleGlyph extends StatelessWidget {
  const GoogleGlyph({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text('G', style: AppType.titleSmall.copyWith(color: context.colors.primaryDark, fontWeight: FontWeight.w800)),
    );
  }
}

/// Wraps a child in a horizontal shake, driven by [controller] (expected to run forward(from: 0)
/// once per error) — makes the error banner impossible to miss without being obnoxious.
class ShakeTransition extends StatelessWidget {
  const ShakeTransition({super.key, required this.controller, required this.child});
  final AnimationController controller;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, c) {
        final t = controller.value;
        final offset = sin(t * pi * 4) * 8 * (1 - t);
        return Transform.translate(offset: Offset(offset, 0), child: c);
      },
      child: child,
    );
  }
}

class StatusBanner extends StatelessWidget {
  const StatusBanner({super.key, required this.message, required this.isError});
  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? context.colors.accentLight : context.colors.success;
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.m),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.m),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(AppSpacing.chipRadius * 1.5),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, color: color, size: 20),
            const SizedBox(width: AppSpacing.s),
            Expanded(child: Text(message, style: AppType.bodySmall.copyWith(color: Colors.white, height: 1.4))),
          ],
        ),
      ),
    );
  }
}

/// Maps Supabase's raw AuthException messages (accurate but not always friendly) into copy that
/// tells the user what to actually do next. Shared by every auth screen that calls Supabase Auth.
String friendlyAuthError(String rawMessage) {
  final msg = rawMessage.toLowerCase();
  if (msg.contains('email not confirmed')) {
    return 'Please confirm your email first — check your inbox for the link we sent you.';
  }
  if (msg.contains('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.contains('already registered') || msg.contains('already exists')) {
    return 'An account with this email already exists — try signing in instead.';
  }
  return rawMessage;
}

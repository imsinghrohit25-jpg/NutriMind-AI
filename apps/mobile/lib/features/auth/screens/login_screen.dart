import 'dart:math';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/design_system/tokens.dart';

// The OAuth callback deep link registered in android/app/src/main/AndroidManifest.xml
// (Google/Apple Sign In via Supabase Auth). iOS needs its own separate URL-scheme entry in
// Info.plist — not added here.
const _kOAuthRedirect = 'nutrimind://login-callback';

enum _PendingAction { none, signIn, signUp, google, apple }

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  _PendingAction _pending = _PendingAction.none;
  bool _obscurePassword = true;
  String? _error;
  String? _info;

  late final AnimationController _entranceController;
  late final Animation<double> _entranceFade;
  late final Animation<Offset> _entranceSlide;

  late final AnimationController _shakeController;

  late final AnimationController _floatController;
  late final Animation<double> _floatOffset;

  bool get _isBusy => _pending != _PendingAction.none;

  @override
  void initState() {
    super.initState();

    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _entranceFade = CurvedAnimation(parent: _entranceController, curve: Curves.easeOut);
    _entranceSlide = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entranceController, curve: Curves.easeOutCubic));
    _entranceController.forward();

    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
    _floatOffset = Tween<double>(begin: -8, end: 8)
        .animate(CurvedAnimation(parent: _floatController, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _entranceController.dispose();
    _shakeController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  void _showError(String message) {
    setState(() {
      _error = message;
      _info = null;
    });
    _shakeController.forward(from: 0);
  }

  /// Supabase's raw AuthException messages are accurate but not always friendly — translates
  /// the common ones into copy that tells the user what to actually do next.
  String _friendlyAuthError(AuthException e) {
    final msg = e.message.toLowerCase();
    if (msg.contains('email not confirmed')) {
      return 'Please confirm your email first — check your inbox for the link we sent you.';
    }
    if (msg.contains('invalid login credentials')) {
      return 'Incorrect email or password.';
    }
    if (msg.contains('already registered') || msg.contains('already exists')) {
      return 'An account with this email already exists — try signing in instead.';
    }
    if (msg.contains('password should be at least')) {
      return e.message;
    }
    return e.message;
  }

  Future<void> _signIn() async {
    if (_isBusy) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _pending = _PendingAction.signIn; _error = null; _info = null; });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
      );
      // GoRouter's redirect (core/router/router.dart) picks up the new session automatically
      // once onAuthStateChange fires — no manual navigation needed here.
    } on AuthException catch (e) {
      _showError(_friendlyAuthError(e));
    } catch (_) {
      _showError('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() { _pending = _PendingAction.none; });
    }
  }

  Future<void> _signUp() async {
    if (_isBusy) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _pending = _PendingAction.signUp; _error = null; _info = null; });
    try {
      final response = await Supabase.instance.client.auth.signUp(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
      );
      if (!mounted) return;
      if (response.session == null) {
        // This project requires email confirmation before a session is issued (Supabase Auth
        // setting, not something this screen controls). Previously this branch didn't exist at
        // all: signUp() would succeed silently and the screen just sat there with no feedback —
        // indistinguishable from a broken/failed signup. This is the actual fix.
        setState(() {
          _info = 'Account created! Check ${_emailCtrl.text.trim()} for a confirmation '
              'link, then sign in below.';
        });
      }
      // else: session != null (auto-confirm enabled) — GoRouter's redirect handles navigation.
    } on AuthException catch (e) {
      _showError(_friendlyAuthError(e));
    } catch (_) {
      _showError('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() { _pending = _PendingAction.none; });
    }
  }

  Future<void> _signInWithProvider(OAuthProvider provider, _PendingAction action) async {
    if (_isBusy) return;
    setState(() { _pending = action; _error = null; _info = null; });
    try {
      await Supabase.instance.client.auth.signInWithOAuth(
        provider,
        redirectTo: _kOAuthRedirect,
      );
    } on AuthException catch (e) {
      _showError(_friendlyAuthError(e));
    } catch (_) {
      _showError('Could not start sign-in. Please try again.');
    } finally {
      if (mounted) setState(() { _pending = _PendingAction.none; });
    }
  }

  Future<void> _forgotPassword() async {
    final email = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ForgotPasswordSheet(initialEmail: _emailCtrl.text.trim()),
    );
    if (email == null || email.isEmpty || !mounted) return;
    try {
      await Supabase.instance.client.auth.resetPasswordForEmail(email);
      if (!mounted) return;
      setState(() { _info = 'Password reset link sent to $email.'; _error = null; });
    } on AuthException catch (e) {
      _showError(_friendlyAuthError(e));
    } catch (_) {
      _showError('Could not send the reset link. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final showApple = !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primaryDark,
              AppColors.primary,
              AppColors.primaryLight,
            ],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, AppSpacing.xl + bottomInset,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - AppSpacing.xl * 2,
                  ),
                  child: IntrinsicHeight(
                    child: FadeTransition(
                      opacity: _entranceFade,
                      child: SlideTransition(
                        position: _entranceSlide,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 440),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Center(
                                    child: AnimatedBuilder(
                                      animation: _floatOffset,
                                      builder: (context, child) => Transform.translate(
                                        offset: Offset(0, _floatOffset.value),
                                        child: child,
                                      ),
                                      child: const _FoodIllustration(),
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xl),
                                  Text(
                                    'NutriMind',
                                    textAlign: TextAlign.center,
                                    style: AppType.displayMedium.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    'Your India-first nutrition guide',
                                    textAlign: TextAlign.center,
                                    style: AppType.bodyLarge.copyWith(
                                      color: Colors.white.withValues(alpha: 0.85),
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xxl),
                                  _GlassCard(
                                    child: Form(
                                      key: _formKey,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.stretch,
                                        children: [
                                          _AuthTextField(
                                            controller: _emailCtrl,
                                            label: 'Email',
                                            icon: Icons.mail_outline_rounded,
                                            keyboardType: TextInputType.emailAddress,
                                            textInputAction: TextInputAction.next,
                                            validator: (v) {
                                              final value = v?.trim() ?? '';
                                              if (value.isEmpty) return 'Enter your email';
                                              if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value)) {
                                                return 'Enter a valid email';
                                              }
                                              return null;
                                            },
                                          ),
                                          const SizedBox(height: AppSpacing.l),
                                          _AuthTextField(
                                            controller: _passCtrl,
                                            label: 'Password',
                                            icon: Icons.lock_outline_rounded,
                                            obscureText: _obscurePassword,
                                            textInputAction: TextInputAction.done,
                                            onSubmitted: (_) => _signIn(),
                                            validator: (v) {
                                              if ((v ?? '').isEmpty) return 'Enter your password';
                                              if ((v ?? '').length < 6) return 'At least 6 characters';
                                              return null;
                                            },
                                            suffixIcon: IconButton(
                                              icon: Icon(
                                                _obscurePassword
                                                    ? Icons.visibility_off_rounded
                                                    : Icons.visibility_rounded,
                                                color: Colors.white.withValues(alpha: 0.8),
                                              ),
                                              onPressed: () => setState(() {
                                                _obscurePassword = !_obscurePassword;
                                              }),
                                            ),
                                          ),
                                          Align(
                                            alignment: Alignment.centerRight,
                                            child: TextButton(
                                              onPressed: _isBusy ? null : _forgotPassword,
                                              style: TextButton.styleFrom(
                                                foregroundColor: Colors.white.withValues(alpha: 0.9),
                                                padding: EdgeInsets.zero,
                                                minimumSize: const Size(0, 36),
                                              ),
                                              child: const Text('Forgot password?'),
                                            ),
                                          ),
                                          AnimatedSize(
                                            duration: const Duration(milliseconds: 250),
                                            child: _error != null
                                                ? _ShakeTransition(
                                                    controller: _shakeController,
                                                    child: _StatusBanner(
                                                      message: _error!,
                                                      isError: true,
                                                    ),
                                                  )
                                                : (_info != null
                                                    ? _StatusBanner(message: _info!, isError: false)
                                                    : const SizedBox.shrink()),
                                          ),
                                          const SizedBox(height: AppSpacing.l),
                                          _PrimaryButton(
                                            label: 'Sign In',
                                            loading: _pending == _PendingAction.signIn,
                                            disabled: _isBusy,
                                            onPressed: _signIn,
                                          ),
                                          const SizedBox(height: AppSpacing.m),
                                          _SecondaryButton(
                                            label: 'Create Account',
                                            loading: _pending == _PendingAction.signUp,
                                            disabled: _isBusy,
                                            onPressed: _signUp,
                                          ),
                                          const SizedBox(height: AppSpacing.xl),
                                          Row(
                                            children: [
                                              Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.35))),
                                              Padding(
                                                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
                                                child: Text(
                                                  'OR CONTINUE WITH',
                                                  style: AppType.labelSmall.copyWith(
                                                    color: Colors.white.withValues(alpha: 0.75),
                                                    letterSpacing: 0.8,
                                                  ),
                                                ),
                                              ),
                                              Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.35))),
                                            ],
                                          ),
                                          const SizedBox(height: AppSpacing.l),
                                          _SocialButton(
                                            label: 'Continue with Google',
                                            loading: _pending == _PendingAction.google,
                                            disabled: _isBusy,
                                            leading: const _GoogleGlyph(),
                                            onPressed: () => _signInWithProvider(
                                              OAuthProvider.google, _PendingAction.google,
                                            ),
                                          ),
                                          if (showApple) ...[
                                            const SizedBox(height: AppSpacing.m),
                                            _SocialButton(
                                              label: 'Continue with Apple',
                                              loading: _pending == _PendingAction.apple,
                                              disabled: _isBusy,
                                              leading: const Icon(Icons.apple, color: Colors.white, size: 22),
                                              onPressed: () => _signInWithProvider(
                                                OAuthProvider.apple, _PendingAction.apple,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
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
class _FoodIllustration extends StatelessWidget {
  const _FoodIllustration();

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
          colors: [
            Colors.white.withValues(alpha: 0.28),
            Colors.white.withValues(alpha: 0.08),
          ],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: const Text('🥗🍎🥑', style: TextStyle(fontSize: 34)),
    );
  }
}

/// Frosted-glass card: translucent white fill + backdrop blur + soft border, the base surface
/// every field/button in this screen sits on.
class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _AuthTextField extends StatelessWidget {
  const _AuthTextField({
    required this.controller,
    required this.label,
    required this.icon,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
    this.suffixIcon,
    this.validator,
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

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onFieldSubmitted: onSubmitted,
      validator: validator,
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
          borderSide: const BorderSide(color: AppColors.accentLight, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: AppColors.accentLight, width: 1.5),
        ),
        errorStyle: const TextStyle(color: Colors.white),
      ),
    );
  }
}

/// The primary call-to-action — a gradient-filled pill button with a smooth loading crossfade.
class _PrimaryButton extends StatefulWidget {
  const _PrimaryButton({
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
  State<_PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<_PrimaryButton> {
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
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: LinearGradient(
              colors: enabled
                  ? [AppColors.accent, AppColors.accentLight]
                  : [Colors.grey, Colors.grey.shade400],
            ),
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.45),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : [],
          ),
          alignment: Alignment.center,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: widget.loading
                ? const SizedBox(
                    key: ValueKey('loading'),
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                  )
                : Text(
                    widget.label,
                    key: const ValueKey('label'),
                    style: AppType.labelLarge.copyWith(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

/// Secondary CTA (Create Account) — glass-outlined rather than solid-filled, so it reads as
/// premium but doesn't visually compete with the primary Sign In button.
class _SecondaryButton extends StatelessWidget {
  const _SecondaryButton({
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
                  key: ValueKey('loading'),
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                )
              : Text(
                  label,
                  key: const ValueKey('label'),
                  style: AppType.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w600),
                ),
        ),
      ),
    );
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.loading,
    required this.disabled,
    required this.leading,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final bool disabled;
  final Widget leading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = !disabled;
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: enabled ? onPressed : null,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white.withValues(alpha: 0.1),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: loading
            ? const SizedBox(
                height: 20, width: 20,
                child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
              )
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
class _GoogleGlyph extends StatelessWidget {
  const _GoogleGlyph();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: const Text(
        'G',
        style: TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w800, fontSize: 14),
      ),
    );
  }
}

/// Wraps a child in a horizontal shake, driven by [controller] (expected to run forward(from: 0)
/// once per error) — makes the error banner impossible to miss without being obnoxious.
class _ShakeTransition extends StatelessWidget {
  const _ShakeTransition({required this.controller, required this.child});
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

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.message, required this.isError});
  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? AppColors.accentLight : const Color(0xFF7FE0A0);
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
            Icon(
              isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
              color: color,
              size: 20,
            ),
            const SizedBox(width: AppSpacing.s),
            Expanded(
              child: Text(
                message,
                style: AppType.bodySmall.copyWith(color: Colors.white, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet({required this.initialEmail});
  final String initialEmail;

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  late final _emailCtrl = TextEditingController(text: widget.initialEmail);

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.l, AppSpacing.xl, AppSpacing.xl),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.96),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.l),
                Text('Reset your password', style: AppType.titleLarge.copyWith(color: Colors.white)),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  "We'll email you a link to set a new password.",
                  style: AppType.bodyMedium.copyWith(color: Colors.white.withValues(alpha: 0.8)),
                ),
                const SizedBox(height: AppSpacing.l),
                _AuthTextField(
                  controller: _emailCtrl,
                  label: 'Email',
                  icon: Icons.mail_outline_rounded,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => Navigator.of(context).pop(_emailCtrl.text.trim()),
                ),
                const SizedBox(height: AppSpacing.l),
                _PrimaryButton(
                  label: 'Send reset link',
                  loading: false,
                  disabled: false,
                  onPressed: () => Navigator.of(context).pop(_emailCtrl.text.trim()),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

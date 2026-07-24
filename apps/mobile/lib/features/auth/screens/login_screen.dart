import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/design_system/haptic_service.dart';
import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/router/routes.dart';
import '../../../core/telemetry/telemetry.dart';
import '../auth_links.dart';
import '../oauth_config.dart';
import '../widgets/auth_ui.dart';

final _log = getLogger('auth.login');

enum _PendingAction { none, signIn, google, apple }

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  _PendingAction _pending = _PendingAction.none;
  bool _obscurePassword = true;
  String? _error;
  String? _info;

  late final AnimationController _shakeController;

  bool get _isBusy => _pending != _PendingAction.none;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(vsync: this, duration: AppMotion.cinematic);
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  void _showError(String message) {
    setState(() { _error = message; _info = null; });
    _shakeController.forward(from: 0);
    // Phase 1 gap-fix (ADR-0037): the shake animation existed, the haptic half of "shake +
    // haptic on invalid submit" didn't.
    HapticService.medium(context: context);
  }

  Future<void> _signIn() async {
    if (_isBusy) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _pending = _PendingAction.signIn; _error = null; _info = null; });
    final email = _emailCtrl.text.trim();
    try {
      _log.info('signInWithPassword() requested for $email');
      await Supabase.instance.client.auth.signInWithPassword(
        email: email,
        password: _passCtrl.text,
      );
      _log.info('signInWithPassword() succeeded for $email');
      // GoRouter's redirect (core/router/router.dart) picks up the new session automatically
      // once onAuthStateChange fires — no manual navigation needed here.
    } on AuthException catch (e, st) {
      _log.warning('signInWithPassword() failed: ${e.message}', e, st);
      _showError(friendlyAuthError(e.message));
    } catch (e, st) {
      _log.warning('signInWithPassword() failed with unexpected error', e, st);
      _showError('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() { _pending = _PendingAction.none; });
    }
  }

  Future<void> _signInWithProvider(OAuthProvider provider, _PendingAction action) async {
    if (_isBusy) return;
    setState(() { _pending = action; _error = null; _info = null; });
    try {
      _log.info('signInWithOAuth($provider) requested, redirectTo=$kAuthCallbackDeepLink');
      await Supabase.instance.client.auth.signInWithOAuth(provider, redirectTo: kAuthCallbackDeepLink);
    } on AuthException catch (e, st) {
      _log.warning('signInWithOAuth($provider) failed: ${e.message}', e, st);
      _showError(friendlyAuthError(e.message));
    } catch (e, st) {
      _log.warning('signInWithOAuth($provider) failed with unexpected error', e, st);
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
      _log.info('resetPasswordForEmail() requested for $email, redirectTo=$kAuthCallbackDeepLink');
      await Supabase.instance.client.auth.resetPasswordForEmail(
        email,
        redirectTo: kAuthCallbackDeepLink,
      );
      _log.info('resetPasswordForEmail() succeeded for $email');
      if (!mounted) return;
      setState(() { _info = 'Password reset link sent to $email.'; _error = null; });
    } on AuthException catch (e, st) {
      _log.warning('resetPasswordForEmail() failed: ${e.message}', e, st);
      _showError(friendlyAuthError(e.message));
    } catch (e, st) {
      _log.warning('resetPasswordForEmail() failed with unexpected error', e, st);
      _showError('Could not send the reset link. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final showApple = !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
    final oauthStatus = ref.watch(oauthProviderStatusProvider);

    return AuthScaffold(
      title: 'NutriMind',
      subtitle: 'Your AI-powered personal nutrition companion',
      card: GlassCard(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AuthTextField(
                controller: _emailCtrl,
                label: 'Email',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                validator: (v) {
                  final value = v?.trim() ?? '';
                  if (value.isEmpty) return 'Enter your email';
                  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value)) return 'Enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.l),
              AuthTextField(
                controller: _passCtrl,
                label: 'Password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscurePassword,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _signIn(),
                validator: (v) {
                  if ((v ?? '').isEmpty) return 'Enter your password';
                  return null;
                },
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
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
                duration: AppMotion.standard,
                child: _error != null
                    ? ShakeTransition(controller: _shakeController, child: StatusBanner(message: _error!, isError: true))
                    : (_info != null ? StatusBanner(message: _info!, isError: false) : const SizedBox.shrink()),
              ),
              const SizedBox(height: AppSpacing.l),
              PrimaryButton(
                label: 'Sign In',
                loading: _pending == _PendingAction.signIn,
                disabled: _isBusy,
                onPressed: _signIn,
              ),
              const SizedBox(height: AppSpacing.m),
              SecondaryButton(
                label: 'Create Account',
                loading: false,
                disabled: _isBusy,
                onPressed: () => context.push(AppRoutes.register),
              ),
              const SizedBox(height: AppSpacing.xl),
              Row(
                children: [
                  Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.35))),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
                    child: Text(
                      'OR CONTINUE WITH',
                      style: AppType.labelSmall.copyWith(color: Colors.white.withValues(alpha: 0.75), letterSpacing: 0.8),
                    ),
                  ),
                  Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.35))),
                ],
              ),
              const SizedBox(height: AppSpacing.l),
              oauthStatus.when(
                data: (status) => SocialButton(
                  label: 'Continue with Google',
                  status: !status.googleEnabled
                      ? SocialButtonStatus.notConfigured
                      : (_pending == _PendingAction.google ? SocialButtonStatus.loading : SocialButtonStatus.ready),
                  leading: const GoogleGlyph(),
                  onPressed: () => _signInWithProvider(OAuthProvider.google, _PendingAction.google),
                ),
                loading: () => SocialButton(
                  label: 'Continue with Google',
                  status: SocialButtonStatus.loading,
                  leading: const GoogleGlyph(),
                  onPressed: () {},
                ),
                error: (_, __) => SocialButton(
                  label: 'Continue with Google',
                  status: SocialButtonStatus.notConfigured,
                  leading: const GoogleGlyph(),
                  onPressed: () {},
                ),
              ),
              if (showApple) ...[
                const SizedBox(height: AppSpacing.m),
                oauthStatus.when(
                  data: (status) => SocialButton(
                    label: 'Continue with Apple',
                    status: !status.appleEnabled
                        ? SocialButtonStatus.notConfigured
                        : (_pending == _PendingAction.apple ? SocialButtonStatus.loading : SocialButtonStatus.ready),
                    leading: const Icon(Icons.apple, color: Colors.white, size: 22),
                    onPressed: () => _signInWithProvider(OAuthProvider.apple, _PendingAction.apple),
                  ),
                  loading: () => SocialButton(
                    label: 'Continue with Apple',
                    status: SocialButtonStatus.loading,
                    leading: const Icon(Icons.apple, color: Colors.white, size: 22),
                    onPressed: () {},
                  ),
                  error: (_, __) => SocialButton(
                    label: 'Continue with Apple',
                    status: SocialButtonStatus.notConfigured,
                    leading: const Icon(Icons.apple, color: Colors.white, size: 22),
                    onPressed: () {},
                  ),
                ),
              ],
            ],
          ),
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
              color: context.colors.primary.withValues(alpha: 0.96),
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
                AuthTextField(
                  controller: _emailCtrl,
                  label: 'Email',
                  icon: Icons.mail_outline_rounded,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => Navigator.of(context).pop(_emailCtrl.text.trim()),
                ),
                const SizedBox(height: AppSpacing.l),
                PrimaryButton(
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/design_system/haptic_service.dart';
import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/telemetry/telemetry.dart';
import '../auth_links.dart';
import '../dial_codes.dart';
import '../widgets/auth_ui.dart';

final _log = getLogger('auth.register');

enum _Gender { male, female, other, preferNotToSay }

extension on _Gender {
  String get label => switch (this) {
    _Gender.male => 'Male',
    _Gender.female => 'Female',
    _Gender.other => 'Other',
    _Gender.preferNotToSay => 'Prefer not to say',
  };
  /// Matches users_profiles.biological_sex's CHECK constraint (migration 0002).
  String get dbValue => switch (this) {
    _Gender.male => 'male',
    _Gender.female => 'female',
    _Gender.other => 'other',
    _Gender.preferNotToSay => 'prefer_not_to_say',
  };
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  DateTime? _dob;
  _Gender? _gender;
  DialCode _dialCode = kDialCodes.first;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _tosAccepted = false;
  bool _submitting = false;
  String? _error;
  String? _info;

  late final AnimationController _shakeController;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(vsync: this, duration: AppMotion.cinematic);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _dobCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _confirmCtrl.dispose();
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

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(now.year - 120),
      lastDate: now,
      helpText: 'Date of birth',
    );
    if (picked != null) {
      setState(() {
        _dob = picked;
        _dobCtrl.text = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  String? _validateDob() {
    if (_dob == null) return 'Enter your date of birth';
    final age = _ageInYears(_dob!);
    if (age < 13) return 'You must be at least 13 years old';
    if (age > 120) return 'Enter a valid date of birth';
    return null;
  }

  int _ageInYears(DateTime dob) {
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) age--;
    return age;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final dobError = _validateDob();
    final formValid = _formKey.currentState?.validate() ?? false;
    if (dobError != null) {
      setState(() {});
      _showError(dobError);
      return;
    }
    if (!formValid) return;
    if (!_tosAccepted) {
      _showError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setState(() { _submitting = true; _error = null; _info = null; });
    try {
      final phoneDigits = _phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
      final e164Phone = '${_dialCode.dialCode}$phoneDigits';
      final email = _emailCtrl.text.trim();

      _log.info('signUp() requested for $email, emailRedirectTo=$kAuthCallbackDeepLink');
      final response = await Supabase.instance.client.auth.signUp(
        email: email,
        password: _passCtrl.text,
        // Without this, GoTrue falls back to the project's Site URL for the
        // confirmation email link — a bare web URL (often left as the
        // Supabase-generated http://localhost:3000 default) that can never
        // hand control back to an Android app. Pointing it at our own deep
        // link means tapping "Confirm your email" opens THIS app directly.
        emailRedirectTo: kAuthCallbackDeepLink,
        data: {
          'full_name': _nameCtrl.text.trim(),
          'date_of_birth': _dob!.toIso8601String().split('T').first,
          'gender': _gender?.dbValue,
          'phone': e164Phone,
        },
      );
      _log.info('signUp() succeeded for $email, session=${response.session != null ? "issued" : "pending email confirmation"}');

      if (!mounted) return;
      if (response.session == null) {
        // This project requires email confirmation before a session is issued — signUp()
        // succeeding with no session is the expected, correct outcome, not a failure. The
        // full_name/date_of_birth/gender/phone above are stashed in Supabase Auth's user
        // metadata now (available regardless of confirmation status); the onboarding profile
        // step reads it back and upserts everything into users_profiles once a real session
        // exists (RLS requires auth.uid() = id, which needs an authenticated session — signUp()
        // alone doesn't grant one while confirmation is pending).
        setState(() {
          _info = 'Account created! Check ${_emailCtrl.text.trim()} for a confirmation link, '
              'then sign in.';
        });
      }
      // else: session != null (auto-confirm enabled) — GoRouter's redirect handles navigation
      // into onboarding automatically.
    } on AuthException catch (e, st) {
      _log.warning('signUp() failed with AuthException: ${e.message}', e, st);
      _showError(friendlyAuthError(e.message));
    } catch (e, st) {
      _log.warning('signUp() failed with unexpected error', e, st);
      _showError('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() { _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Create your account',
      subtitle: 'Join NutriMind — your AI-powered nutrition companion',
      showIllustration: false,
      leading: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.m),
        child: Align(
          alignment: Alignment.centerLeft,
          child: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
      ),
      card: GlassCard(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AuthTextField(
                controller: _nameCtrl,
                label: 'Full Name',
                icon: Icons.person_outline_rounded,
                textInputAction: TextInputAction.next,
                validator: (v) {
                  final value = v?.trim() ?? '';
                  if (value.isEmpty) return 'Enter your full name';
                  if (value.length < 2) return 'Enter your full name';
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.l),
              AuthTextField(
                controller: _dobCtrl,
                label: 'Date of Birth',
                icon: Icons.cake_outlined,
                readOnly: true,
                onTap: _pickDob,
                validator: (_) => _validateDob(),
              ),
              const SizedBox(height: AppSpacing.l),
              Text('Gender (optional)', style: AppType.bodySmall.copyWith(color: Colors.white.withValues(alpha: 0.75))),
              const SizedBox(height: AppSpacing.s),
              Theme(
                data: Theme.of(context).copyWith(canvasColor: Colors.transparent),
                child: Wrap(
                  spacing: AppSpacing.s,
                  runSpacing: AppSpacing.s,
                  children: _Gender.values.map((g) {
                    final selected = _gender == g;
                    return ChoiceChip(
                      label: Text(g.label),
                      selected: selected,
                      onSelected: (_) => setState(() => _gender = selected ? null : g),
                      labelStyle: TextStyle(color: selected ? context.colors.primaryDark : Colors.white),
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      selectedColor: Colors.white,
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: AppSpacing.l),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 110,
                    child: DropdownButtonFormField<DialCode>(
                      initialValue: _dialCode,
                      isExpanded: true,
                      dropdownColor: context.colors.primaryDark,
                      icon: Icon(Icons.arrow_drop_down, color: Colors.white.withValues(alpha: 0.8)),
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white.withValues(alpha: 0.12),
                        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.m, vertical: AppSpacing.m),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(999),
                          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(999),
                          borderSide: const BorderSide(color: Colors.white, width: 1.5),
                        ),
                      ),
                      items: kDialCodes
                          .map((d) => DropdownMenuItem(value: d, child: Text('${d.dialCode} ${d.iso}', overflow: TextOverflow.ellipsis)))
                          .toList(),
                      onChanged: (v) => setState(() => _dialCode = v ?? _dialCode),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.m),
                  Expanded(
                    child: AuthTextField(
                      controller: _phoneCtrl,
                      label: 'Phone Number',
                      icon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      validator: (v) {
                        final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                        if (digits.isEmpty) return 'Enter your phone number';
                        if (digits.length < 6 || digits.length > 14) return 'Enter a valid phone number';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.l),
              AuthTextField(
                controller: _emailCtrl,
                label: 'Email Address',
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
                textInputAction: TextInputAction.next,
                validator: (v) {
                  final value = v ?? '';
                  if (value.isEmpty) return 'Enter a password';
                  if (value.length < 8) return 'At least 8 characters';
                  if (!RegExp(r'[A-Za-z]').hasMatch(value) || !RegExp(r'[0-9]').hasMatch(value)) {
                    return 'Include at least one letter and one number';
                  }
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
              const SizedBox(height: AppSpacing.l),
              AuthTextField(
                controller: _confirmCtrl,
                label: 'Confirm Password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscureConfirm,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
                validator: (v) {
                  if ((v ?? '').isEmpty) return 'Confirm your password';
                  if (v != _passCtrl.text) return 'Passwords do not match';
                  return null;
                },
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConfirm ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                  onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                ),
              ),
              const SizedBox(height: AppSpacing.l),
              InkWell(
                onTap: () => setState(() => _tosAccepted = !_tosAccepted),
                borderRadius: BorderRadius.circular(8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _tosAccepted,
                      onChanged: (v) => setState(() => _tosAccepted = v ?? false),
                      activeColor: Colors.white,
                      checkColor: context.colors.primaryDark,
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.6)),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          'I agree to the Terms of Service and Privacy Policy',
                          style: AppType.bodySmall.copyWith(color: Colors.white.withValues(alpha: 0.9)),
                        ),
                      ),
                    ),
                  ],
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
                label: 'Create Account',
                loading: _submitting,
                disabled: _submitting,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

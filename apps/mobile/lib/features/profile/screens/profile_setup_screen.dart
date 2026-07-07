import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/tokens.dart';
import '../../../core/offline/local_db.dart';

// Profile setup — collects age, weight, height, activity level for TDEE/macro calc.
// Values stored locally (Drift) and synced to API at profile completion.

enum ActivityLevel { sedentary, light, moderate, active, veryActive }

extension ActivityLevelLabel on ActivityLevel {
  String get label => switch (this) {
    ActivityLevel.sedentary  => 'Sedentary (desk job, no exercise)',
    ActivityLevel.light      => 'Light (1–3 days/week exercise)',
    ActivityLevel.moderate   => 'Moderate (3–5 days/week)',
    ActivityLevel.active     => 'Active (6–7 days/week)',
    ActivityLevel.veryActive => 'Very active (twice daily)',
  };
  double get factor => switch (this) {
    ActivityLevel.sedentary  => 1.2,
    ActivityLevel.light      => 1.375,
    ActivityLevel.moderate   => 1.55,
    ActivityLevel.active     => 1.725,
    ActivityLevel.veryActive => 1.9,
  };
}

class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _ageCtrl    = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();
  String _sex = 'male';
  ActivityLevel _activity = ActivityLevel.moderate;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _ageCtrl.dispose();
    _weightCtrl.dispose();
    _heightCtrl.dispose();
    super.dispose();
  }

  double? get _tdee {
    final age    = int.tryParse(_ageCtrl.text);
    final weight = double.tryParse(_weightCtrl.text);
    final height = double.tryParse(_heightCtrl.text);
    if (age == null || weight == null || height == null) return null;
    // Mifflin-St Jeor BMR
    final bmr = _sex == 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    return bmr * _activity.factor;
  }

  Future<void> _save() async {
    final tdee = _tdee;
    if (tdee == null) {
      setState(() => _error = 'Please fill in all fields with valid numbers');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      final db = ref.read(localDbProvider);
      await db.setFlag('profile_complete', 'true');
      await db.setFlag('profile_tdee', tdee.toStringAsFixed(0));
      await db.setFlag('profile_sex', _sex);
      await db.setFlag('profile_activity', _activity.name);
      ref.invalidate(onboardingStateProvider);
    } catch (e) {
      setState(() => _error = 'Failed to save profile. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Your Profile')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Set up your profile', style: AppType.headlineLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Used to calculate your daily nutrition targets', style: AppType.bodyMedium.copyWith(color: AppColors.subtle)),
              const SizedBox(height: AppSpacing.xl),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'male',   label: Text('Male')),
                  ButtonSegment(value: 'female', label: Text('Female')),
                  ButtonSegment(value: 'other',  label: Text('Other')),
                ],
                selected: {_sex},
                onSelectionChanged: (s) => setState(() => _sex = s.first),
              ),
              const SizedBox(height: AppSpacing.l),
              Row(children: [
                Expanded(child: TextField(controller: _ageCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Age (years)'))),
                const SizedBox(width: AppSpacing.m),
                Expanded(child: TextField(controller: _weightCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Weight (kg)'))),
                const SizedBox(width: AppSpacing.m),
                Expanded(child: TextField(controller: _heightCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Height (cm)'))),
              ]),
              const SizedBox(height: AppSpacing.xl),
              const Text('Activity level', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.s),
              // ignore: deprecated_member_use
              ...ActivityLevel.values.map((level) => RadioListTile<ActivityLevel>(
                value: level,
                // ignore: deprecated_member_use
                groupValue: _activity,
                // ignore: deprecated_member_use
                onChanged: (v) => setState(() => _activity = v!),
                title: Text(level.label, style: AppType.bodyMedium),
                activeColor: AppColors.primary,
                dense: true,
              )),
              if (_tdee != null) ...[
                const SizedBox(height: AppSpacing.l),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.l),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(15),
                    borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
                  ),
                  child: Row(children: [
                    const Icon(Icons.local_fire_department, color: AppColors.accent),
                    const SizedBox(width: AppSpacing.m),
                    Expanded(child: Text(
                      'Estimated daily target: ${_tdee!.toStringAsFixed(0)} kcal\n(Mifflin-St Jeor formula — how we calculated this)',
                      style: AppType.bodyMedium,
                    )),
                  ]),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.m),
                Text(_error!, style: AppType.bodySmall.copyWith(color: AppColors.error)),
              ],
              const SizedBox(height: AppSpacing.xl),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Save profile'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/offline/local_db.dart';
import '../../../core/telemetry/telemetry.dart';

final _log = getLogger('onboarding.profile');

// Profile setup — the final onboarding step. Collects (or confirms, for accounts created via
// Google/Apple sign-in that never passed through RegisterScreen) height/weight/activity, dietary
// preference, primary health goal, food allergies, and medical conditions, then performs ONE
// real upsert into public.users_profiles combining this screen's fields with whatever
// full_name/date_of_birth/gender/phone RegisterScreen already stashed in Supabase Auth's user
// metadata at signup time.
//
// Previously this screen only ever wrote to local on-device storage (Drift flags) — the
// Nutrition Engine, or this same user signing in on a second device, would never see any of this
// data. That silent gap is what this rewrite actually fixes; the local flag is now just a fast
// redirect-gate cache, set only after the real upsert succeeds.

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
  /// DB value — matches users_profiles.activity_level's CHECK constraint (migration 0002),
  /// which uses `lightly_active`/`moderately_active` rather than this enum's shorter names.
  String get dbValue => switch (this) {
    ActivityLevel.sedentary  => 'sedentary',
    ActivityLevel.light      => 'lightly_active',
    ActivityLevel.moderate   => 'moderately_active',
    ActivityLevel.active     => 'very_active',
    ActivityLevel.veryActive => 'extra_active',
  };
}

enum DietType { nonVegetarian, vegetarian, eggetarian, vegan, jain, other }

extension DietTypeLabel on DietType {
  String get label => switch (this) {
    DietType.nonVegetarian => 'Non-Vegetarian',
    DietType.vegetarian    => 'Vegetarian',
    DietType.eggetarian    => 'Eggetarian',
    DietType.vegan         => 'Vegan',
    DietType.jain          => 'Jain',
    DietType.other         => 'Other',
  };
  /// Matches users_profiles.diet_type's CHECK constraint (migration 0002).
  String get dbValue => switch (this) {
    DietType.nonVegetarian => 'non_vegetarian',
    DietType.vegetarian    => 'vegetarian',
    DietType.eggetarian    => 'eggetarian',
    DietType.vegan         => 'vegan',
    DietType.jain          => 'jain',
    DietType.other         => 'other',
  };
}

enum HealthGoal { weightLoss, muscleGain, diabetesManagement, generalHealth, heartHealth, other }

extension HealthGoalLabel on HealthGoal {
  String get label => switch (this) {
    HealthGoal.weightLoss          => 'Weight Loss',
    HealthGoal.muscleGain          => 'Muscle Gain',
    HealthGoal.diabetesManagement  => 'Diabetes Management',
    HealthGoal.generalHealth       => 'General Health',
    HealthGoal.heartHealth         => 'Heart Health',
    HealthGoal.other               => 'Other',
  };
  /// Matches users_profiles.primary_health_goal's CHECK constraint (migration 0035).
  String get dbValue => switch (this) {
    HealthGoal.weightLoss         => 'weight_loss',
    HealthGoal.muscleGain         => 'muscle_gain',
    HealthGoal.diabetesManagement => 'diabetes_management',
    HealthGoal.generalHealth      => 'general_health',
    HealthGoal.heartHealth        => 'heart_health',
    HealthGoal.other              => 'other',
  };
  /// Derives the TDEE engine's own weight-direction input (users_profiles.goal, migration 0002)
  /// from the richer user-facing goal above — the engine only ever needs lose/maintain/gain and
  /// must keep receiving exactly one of those three values, never a new one.
  String get engineGoal => switch (this) {
    HealthGoal.weightLoss => 'lose',
    HealthGoal.muscleGain => 'gain',
    _                     => 'maintain',
  };
}

/// The same 14-allergen taxonomy the backend's allergen-detection engine uses
/// (apps/api/src/engines/allergen/taxonomy.ts) — kept in sync manually since this is a separate
/// Dart codebase with no shared-codegen boundary with the TS engine.
const kAllergenOptions = <String, String>{
  'gluten': 'Gluten (Wheat/Barley/Rye)',
  'peanut': 'Peanut (Groundnut)',
  'tree_nuts': 'Tree Nuts',
  'milk': 'Milk (Dairy)',
  'egg': 'Egg',
  'soy': 'Soy (Soybean)',
  'fish': 'Fish',
  'shellfish': 'Shellfish / Crustaceans',
  'sesame': 'Sesame',
  'mustard': 'Mustard',
  'celery': 'Celery',
  'lupin': 'Lupin',
  'molluscs': 'Molluscs',
  'sulphites': 'Sulphites / Sulphur dioxide',
};

// Advanced personalization fields (migration 0036) — all optional. Enums mirror the DB CHECK
// constraints exactly (users_profiles, migration 0036) the same way ActivityLevel/DietType/
// HealthGoal above mirror migration 0002/0035's constraints.
enum BudgetLevel { budget, moderate, premium }

extension BudgetLevelLabel on BudgetLevel {
  String get label => switch (this) {
    BudgetLevel.budget   => 'Budget-conscious',
    BudgetLevel.moderate => 'Moderate',
    BudgetLevel.premium  => 'Flexible / premium',
  };
  String get dbValue => name;
}

enum StressLevelOption { low, moderate, high }

extension StressLevelLabel on StressLevelOption {
  String get label => switch (this) {
    StressLevelOption.low      => 'Low',
    StressLevelOption.moderate => 'Moderate',
    StressLevelOption.high     => 'High',
  };
  String get dbValue => name;
}

enum MealTimingPattern { standard, intermittentFasting168, intermittentFasting186, earlyDinner, lateDinner, shiftWork, other }

extension MealTimingPatternLabel on MealTimingPattern {
  String get label => switch (this) {
    MealTimingPattern.standard               => 'Standard (3 meals/day)',
    MealTimingPattern.intermittentFasting168 => 'Intermittent fasting (16:8)',
    MealTimingPattern.intermittentFasting186 => 'Intermittent fasting (18:6)',
    MealTimingPattern.earlyDinner            => 'Early dinner',
    MealTimingPattern.lateDinner             => 'Late dinner',
    MealTimingPattern.shiftWork              => 'Shift work (irregular timing)',
    MealTimingPattern.other                  => 'Other',
  };
  String get dbValue => switch (this) {
    MealTimingPattern.intermittentFasting168 => 'intermittent_fasting_16_8',
    MealTimingPattern.intermittentFasting186 => 'intermittent_fasting_18_6',
    MealTimingPattern.earlyDinner            => 'early_dinner',
    MealTimingPattern.lateDinner             => 'late_dinner',
    MealTimingPattern.shiftWork              => 'shift_work',
    MealTimingPattern.standard               => 'standard',
    MealTimingPattern.other                  => 'other',
  };
}

enum ReligionOption { hindu, muslim, christian, sikh, buddhist, jewish, jain, other, preferNotToSay }

extension ReligionOptionLabel on ReligionOption {
  String get label => switch (this) {
    ReligionOption.hindu          => 'Hindu',
    ReligionOption.muslim         => 'Muslim',
    ReligionOption.christian      => 'Christian',
    ReligionOption.sikh           => 'Sikh',
    ReligionOption.buddhist       => 'Buddhist',
    ReligionOption.jewish         => 'Jewish',
    ReligionOption.jain           => 'Jain',
    ReligionOption.other          => 'Other',
    ReligionOption.preferNotToSay => 'Prefer not to say',
  };
  String get dbValue => this == ReligionOption.preferNotToSay ? 'prefer_not_to_say' : name;
}

enum ReproductiveStatusOption { none, pregnant, lactating }

extension ReproductiveStatusLabel on ReproductiveStatusOption {
  String get label => switch (this) {
    ReproductiveStatusOption.none      => 'Not applicable',
    ReproductiveStatusOption.pregnant  => 'Pregnant',
    ReproductiveStatusOption.lactating => 'Breastfeeding / lactating',
  };
  String get dbValue => name;
}

enum AthleteStatusOption { none, recreational, competitiveEndurance, competitiveStrength, other }

extension AthleteStatusLabel on AthleteStatusOption {
  String get label => switch (this) {
    AthleteStatusOption.none                 => 'Not an athlete',
    AthleteStatusOption.recreational         => 'Recreational',
    AthleteStatusOption.competitiveEndurance => 'Competitive — endurance',
    AthleteStatusOption.competitiveStrength  => 'Competitive — strength',
    AthleteStatusOption.other                => 'Other',
  };
  String get dbValue => switch (this) {
    AthleteStatusOption.competitiveEndurance => 'competitive_endurance',
    AthleteStatusOption.competitiveStrength  => 'competitive_strength',
    AthleteStatusOption.none                 => 'none',
    AthleteStatusOption.recreational         => 'recreational',
    AthleteStatusOption.other                => 'other',
  };
}

const kConditionOptions = <String, String>{
  'diabetes': 'Diabetes',
  'hypertension': 'Hypertension (High Blood Pressure)',
  'high_cholesterol': 'High Cholesterol',
  'heart_disease': 'Heart Disease',
  'kidney_disease': 'Kidney Disease',
  'thyroid': 'Thyroid Condition',
  'pcos': 'PCOS',
  'fatty_liver': 'Fatty Liver',
  'pregnancy': 'Pregnancy',
  'obesity': 'Obesity / Weight Management',
  'other': 'Other',
};

class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _nameCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();

  String _sex = 'male';
  ActivityLevel _activity = ActivityLevel.moderate;
  DietType _diet = DietType.nonVegetarian;
  HealthGoal _goal = HealthGoal.generalHealth;
  final Set<String> _allergies = {};
  final Set<String> _conditions = {};

  // Advanced personalization (migration 0036) — every one of these stays null/empty unless the
  // user opens the section and sets it; the upsert below only ever sends what's actually set.
  final _medicationsCtrl = TextEditingController();
  final _sleepHoursCtrl = TextEditingController();
  final _bodyFatCtrl = TextEditingController();
  final _waistCtrl = TextEditingController();
  BudgetLevel? _budgetLevel;
  StressLevelOption? _stressLevel;
  MealTimingPattern? _mealTimingPattern;
  ReligionOption? _religion;
  ReproductiveStatusOption? _reproductiveStatus;
  AthleteStatusOption? _athleteStatus;
  bool _showAdvanced = false;

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final metadata = Supabase.instance.client.auth.currentUser?.userMetadata;
    _nameCtrl.text = (metadata?['full_name'] as String?) ?? '';
    final dobString = metadata?['date_of_birth'] as String?;
    if (dobString != null) {
      final dob = DateTime.tryParse(dobString);
      if (dob != null) {
        final now = DateTime.now();
        var age = now.year - dob.year;
        if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) age--;
        _ageCtrl.text = age.toString();
      }
    }
    final gender = metadata?['gender'] as String?;
    if (gender == 'male' || gender == 'female' || gender == 'other') _sex = gender!;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _ageCtrl.dispose();
    _weightCtrl.dispose();
    _heightCtrl.dispose();
    _medicationsCtrl.dispose();
    _sleepHoursCtrl.dispose();
    _bodyFatCtrl.dispose();
    _waistCtrl.dispose();
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
    if (_nameCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please enter your name');
      return;
    }
    final tdee = _tdee;
    if (tdee == null) {
      setState(() => _error = 'Please fill in all fields with valid numbers');
      return;
    }
    setState(() { _saving = true; _error = null; });

    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      setState(() { _error = 'You are not signed in. Please sign in again.'; _saving = false; });
      return;
    }

    try {
      final db = ref.read(localDbProvider);
      final metadata = user.userMetadata;
      final languageCode = await db.getFlag('language_code') ?? 'en';

      _log.info('Saving profile for user ${user.id}');
      await Supabase.instance.client.from('users_profiles').upsert({
        'id': user.id,
        'display_name': _nameCtrl.text.trim(),
        'age_years': int.parse(_ageCtrl.text),
        'biological_sex': _sex,
        'height_cm': double.parse(_heightCtrl.text),
        'weight_kg': double.parse(_weightCtrl.text),
        'activity_level': _activity.dbValue,
        'goal': _goal.engineGoal,
        'primary_health_goal': _goal.dbValue,
        'diet_type': _diet.dbValue,
        'allergens': _allergies.toList(),
        'conditions': _conditions.toList(),
        'preferred_language': languageCode,
        'date_of_birth': metadata?['date_of_birth'],
        'phone_number': metadata?['phone'],
        'tdee_kcal': tdee.round(),
        'onboarding_complete': true,
        // Advanced personalization (migration 0036) — every field here is optional; null means
        // "not provided" and is exactly what the column already defaults to for a new profile.
        'medications': _medicationsCtrl.text.trim().isEmpty
            ? <String>[]
            : _medicationsCtrl.text.split(',').map((m) => m.trim()).where((m) => m.isNotEmpty).toList(),
        'budget_level': _budgetLevel?.dbValue,
        'sleep_hours_avg': double.tryParse(_sleepHoursCtrl.text),
        'stress_level': _stressLevel?.dbValue,
        'meal_timing_pattern': _mealTimingPattern?.dbValue,
        'religion': _religion?.dbValue,
        'reproductive_status': _reproductiveStatus?.dbValue,
        'athlete_status': _athleteStatus?.dbValue,
        'body_fat_pct': double.tryParse(_bodyFatCtrl.text),
        'waist_circumference_cm': double.tryParse(_waistCtrl.text),
      }).timeout(const Duration(seconds: 15)); // design-governance:ignore: network timeout, not an animation

      await db.setFlag('profile_complete', 'true');
      _log.info('Profile saved for user ${user.id}');
      ref.invalidate(onboardingStateProvider);
    } on TimeoutException catch (e, st) {
      _log.warning('Profile save timed out', e, st);
      setState(() => _error = 'This is taking too long. Check your connection and try again.');
    } on PostgrestException catch (e, st) {
      _log.warning('Profile save failed: ${e.message}', e, st);
      setState(() => _error = 'Could not save your profile: ${e.message}');
    } catch (e, st) {
      _log.warning('Profile save failed with unexpected error', e, st);
      setState(() => _error = 'Failed to save profile. Please check your connection and try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complete your profile')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Tell us about yourself', style: AppType.headlineLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Used to calculate your daily nutrition targets and keep you safe', style: AppType.bodyMedium.copyWith(color: context.colors.subtle)),
              const SizedBox(height: AppSpacing.xl),

              TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Full Name')),
              const SizedBox(height: AppSpacing.l),

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
                activeColor: context.colors.primary,
                dense: true,
              )),

              const SizedBox(height: AppSpacing.xl),
              const Text('Dietary preference', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.s),
              Wrap(
                spacing: AppSpacing.s,
                runSpacing: AppSpacing.s,
                children: DietType.values.map((d) => ChoiceChip(
                  label: Text(d.label),
                  selected: _diet == d,
                  onSelected: (_) => setState(() => _diet = d),
                )).toList(),
              ),

              const SizedBox(height: AppSpacing.xl),
              const Text('Primary health goal', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.s),
              Wrap(
                spacing: AppSpacing.s,
                runSpacing: AppSpacing.s,
                children: HealthGoal.values.map((g) => ChoiceChip(
                  label: Text(g.label),
                  selected: _goal == g,
                  onSelected: (_) => setState(() => _goal = g),
                )).toList(),
              ),

              const SizedBox(height: AppSpacing.xl),
              const Text('Food allergies', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text('Select any that apply — used to warn you about products that contain them.', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
              const SizedBox(height: AppSpacing.s),
              Wrap(
                spacing: AppSpacing.s,
                runSpacing: AppSpacing.s,
                children: kAllergenOptions.entries.map((e) => FilterChip(
                  label: Text(e.value),
                  selected: _allergies.contains(e.key),
                  onSelected: (v) => setState(() => v ? _allergies.add(e.key) : _allergies.remove(e.key)),
                )).toList(),
              ),

              const SizedBox(height: AppSpacing.xl),
              const Text('Medical conditions (optional)', style: AppType.titleMedium),
              const SizedBox(height: AppSpacing.s),
              Wrap(
                spacing: AppSpacing.s,
                runSpacing: AppSpacing.s,
                children: kConditionOptions.entries.map((e) => FilterChip(
                  label: Text(e.value),
                  selected: _conditions.contains(e.key),
                  onSelected: (v) => setState(() => v ? _conditions.add(e.key) : _conditions.remove(e.key)),
                )).toList(),
              ),

              const SizedBox(height: AppSpacing.xl),
              InkWell(
                onTap: () => setState(() => _showAdvanced = !_showAdvanced),
                child: Row(children: [
                  const Text('Advanced personalization (optional)', style: AppType.titleMedium),
                  const SizedBox(width: AppSpacing.s),
                  Icon(_showAdvanced ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, color: context.colors.subtle),
                ]),
              ),
              if (_showAdvanced) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Every field below is optional — the AI uses whatever you provide to personalize its answers further.',
                  style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                ),
                const SizedBox(height: AppSpacing.l),

                const Text('Grocery budget', style: AppType.labelMedium),
                const SizedBox(height: AppSpacing.xs),
                Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: BudgetLevel.values.map((b) => ChoiceChip(
                  label: Text(b.label), selected: _budgetLevel == b,
                  onSelected: (v) => setState(() => _budgetLevel = v ? b : null),
                )).toList()),
                const SizedBox(height: AppSpacing.l),

                const Text('Athlete status', style: AppType.labelMedium),
                const SizedBox(height: AppSpacing.xs),
                Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: AthleteStatusOption.values.map((a) => ChoiceChip(
                  label: Text(a.label), selected: _athleteStatus == a,
                  onSelected: (v) => setState(() => _athleteStatus = v ? a : null),
                )).toList()),
                const SizedBox(height: AppSpacing.l),

                const Text('Pregnancy / lactation', style: AppType.labelMedium),
                const SizedBox(height: AppSpacing.xs),
                Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: ReproductiveStatusOption.values.map((r) => ChoiceChip(
                  label: Text(r.label), selected: _reproductiveStatus == r,
                  onSelected: (v) => setState(() => _reproductiveStatus = v ? r : null),
                )).toList()),
                const SizedBox(height: AppSpacing.l),

                const Text('Stress level', style: AppType.labelMedium),
                const SizedBox(height: AppSpacing.xs),
                Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: StressLevelOption.values.map((s) => ChoiceChip(
                  label: Text(s.label), selected: _stressLevel == s,
                  onSelected: (v) => setState(() => _stressLevel = v ? s : null),
                )).toList()),
                const SizedBox(height: AppSpacing.l),

                const Text('Meal timing pattern', style: AppType.labelMedium),
                const SizedBox(height: AppSpacing.xs),
                DropdownButtonFormField<MealTimingPattern>(
                  initialValue: _mealTimingPattern,
                  decoration: const InputDecoration(hintText: 'Not set'),
                  items: MealTimingPattern.values.map((m) => DropdownMenuItem(value: m, child: Text(m.label))).toList(),
                  onChanged: (v) => setState(() => _mealTimingPattern = v),
                ),
                const SizedBox(height: AppSpacing.l),

                const Text('Religion', style: AppType.labelMedium),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Stored for your reference only — never used to automatically exclude foods.',
                  style: AppType.labelSmall.copyWith(color: context.colors.subtle),
                ),
                const SizedBox(height: AppSpacing.xs),
                DropdownButtonFormField<ReligionOption>(
                  initialValue: _religion,
                  decoration: const InputDecoration(hintText: 'Not set'),
                  items: ReligionOption.values.map((r) => DropdownMenuItem(value: r, child: Text(r.label))).toList(),
                  onChanged: (v) => setState(() => _religion = v),
                ),
                const SizedBox(height: AppSpacing.l),

                Row(children: [
                  Expanded(child: TextField(
                    controller: _sleepHoursCtrl, keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Avg. sleep (hours)'),
                  )),
                  const SizedBox(width: AppSpacing.m),
                  Expanded(child: TextField(
                    controller: _bodyFatCtrl, keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Body fat % (optional)'),
                  )),
                ]),
                const SizedBox(height: AppSpacing.l),
                TextField(
                  controller: _waistCtrl, keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Waist circumference (cm, optional)'),
                ),
                const SizedBox(height: AppSpacing.l),

                TextField(
                  controller: _medicationsCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Medications (optional)',
                    hintText: 'e.g. levothyroxine, metformin — comma-separated',
                  ),
                ),
              ],

              if (_tdee != null) ...[
                const SizedBox(height: AppSpacing.l),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.l),
                  decoration: BoxDecoration(
                    color: context.colors.primary.withAlpha(15),
                    borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
                  ),
                  child: Row(children: [
                    Icon(Icons.local_fire_department, color: context.colors.accent),
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
                Text(_error!, style: AppType.bodySmall.copyWith(color: context.colors.error)),
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

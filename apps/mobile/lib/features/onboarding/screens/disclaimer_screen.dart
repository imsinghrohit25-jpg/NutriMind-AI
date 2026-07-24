import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/offline/local_db.dart';

// Disclaimer gate — output policy enforcement at the UI level.
// Blocking: user CANNOT proceed to the app without explicitly accepting.
// Stored as 'disclaimer_v1' flag. Matches backend output-policy (Phase 2).

class DisclaimerScreen extends ConsumerStatefulWidget {
  const DisclaimerScreen({super.key});

  @override
  ConsumerState<DisclaimerScreen> createState() => _DisclaimerScreenState();
}

class _DisclaimerScreenState extends ConsumerState<DisclaimerScreen> {
  bool _accepted = false;
  bool _saving = false;

  Future<void> _accept() async {
    if (!_accepted) return;
    setState(() => _saving = true);
    final db = ref.read(localDbProvider);
    await db.setFlag('disclaimer_v1', 'true');
    ref.invalidate(onboardingStateProvider);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Health Information Disclaimer')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.l),
                decoration: BoxDecoration(
                  color: context.colors.warning.withAlpha(20),
                  borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
                  border: Border.all(color: context.colors.warning.withAlpha(60)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: context.colors.warning),
                    const SizedBox(width: AppSpacing.m),
                    Expanded(
                      child: Text(
                        'NutriMind provides nutrition information, not medical advice.',
                        style: AppType.bodyMedium.copyWith(color: context.colors.warning),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              Expanded(
                child: SingleChildScrollView(
                  child: Text(
                    '''NutriMind is a nutrition information tool, not a medical device or healthcare service.

IMPORTANT — PLEASE READ:

• NutriMind does NOT provide medical diagnoses, disease management advice, or medication recommendations.

• Nutrition scores and information are for general awareness only and are not a substitute for professional dietary advice.

• If you have a medical condition, allergy, or specific dietary requirement, always consult a qualified healthcare professional (doctor, registered dietitian) before making changes to your diet.

• NutriMind's allergen and ingredient information is sourced from product databases and may not be complete or up to date. Always read product labels carefully.

• Nutritional values are per-100g estimates from third-party databases (OpenFoodFacts, USDA FDC, IFCT 2017). Actual values may vary by batch, preparation method, or serving size.

• Do NOT use NutriMind to manage, treat, or diagnose any medical condition.

By continuing, you confirm that you understand and accept these limitations.''',
                    style: AppType.bodyMedium.copyWith(color: context.colors.onSurface),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.l),
              CheckboxListTile(
                value: _accepted,
                onChanged: (v) => setState(() => _accepted = v ?? false),
                title: const Text('I understand this is not medical advice and I accept the disclaimer'),
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: context.colors.primary,
              ),
              const SizedBox(height: AppSpacing.l),
              FilledButton(
                onPressed: _accepted && !_saving ? _accept : null,
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('I understand — continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

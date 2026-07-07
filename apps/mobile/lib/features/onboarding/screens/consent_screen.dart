import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/tokens.dart';
import '../../../core/offline/local_db.dart';

// Consent gate — MUST be accepted before any data is processed.
// Stored as local flag 'consent_v1' so it persists across app restarts.
// Router guard checks onboardingStateProvider and redirects here if not accepted.

class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key});

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  bool _accepted = false;
  bool _saving = false;

  Future<void> _accept() async {
    if (!_accepted) return;
    setState(() => _saving = true);
    final db = ref.read(localDbProvider);
    await db.setFlag('consent_v1', 'true');
    // Invalidate onboarding state so router re-evaluates redirect
    ref.invalidate(onboardingStateProvider);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Data & Privacy')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('How we use your data', style: AppType.headlineLarge),
              const SizedBox(height: AppSpacing.xl),
              const Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ConsentPoint(
                        icon: Icons.lock_outline,
                        title: 'Your health data stays private',
                        body: 'Health conditions, allergies, and meal history are stored securely and never sold or shared with advertisers.',
                      ),
                      _ConsentPoint(
                        icon: Icons.analytics_outlined,
                        title: 'Nutrition analysis',
                        body: 'Food scans are analysed using AI. Product images may be sent to our servers for processing.',
                      ),
                      _ConsentPoint(
                        icon: Icons.family_restroom,
                        title: 'Household profiles',
                        body: 'If you add household members, their profiles are stored locally and on our servers under your account.',
                      ),
                      _ConsentPoint(
                        icon: Icons.delete_outline,
                        title: 'Right to deletion',
                        body: 'You can delete your account and all associated data at any time from Profile → Delete account.',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.l),
              CheckboxListTile(
                value: _accepted,
                onChanged: (v) => setState(() => _accepted = v ?? false),
                title: const Text('I have read and agree to the data usage policy'),
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: AppColors.primary,
              ),
              const SizedBox(height: AppSpacing.l),
              FilledButton(
                onPressed: _accepted && !_saving ? _accept : null,
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConsentPoint extends StatelessWidget {
  const _ConsentPoint({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primary, size: 24),
          const SizedBox(width: AppSpacing.l),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppType.titleMedium),
                const SizedBox(height: AppSpacing.xs),
                Text(body, style: AppType.bodyMedium.copyWith(color: AppColors.subtle)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

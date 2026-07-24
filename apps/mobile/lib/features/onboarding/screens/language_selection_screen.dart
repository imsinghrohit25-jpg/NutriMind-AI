import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/offline/local_db.dart';

// Preferred-language onboarding step (global platform rebuild) — the actual, currently-generated
// set of supported locales (lib/l10n/app_localizations_*.dart), not a guessed/arbitrary list.
// Persisted the same way country/consent/disclaimer already are: a local flag gates the router,
// and the choice is folded into the single users_profiles upsert at the end of onboarding
// (profile_setup_screen.dart) rather than written here on its own — this user's users_profiles
// row doesn't exist yet at this point in the flow, so a partial update here would silently
// affect zero rows.

const kSupportedLanguages = <String, String>{
  'en': 'English',
  'hi': 'हिन्दी (Hindi)',
  'es': 'Español (Spanish)',
  'fr': 'Français (French)',
  'ar': 'العربية (Arabic)',
  'pt': 'Português (Portuguese)',
  'de': 'Deutsch (German)',
  'ja': '日本語 (Japanese)',
  'id': 'Bahasa Indonesia',
  'ur': 'اردو (Urdu)',
  'bn': 'বাংলা (Bengali)',
  'ta': 'தமிழ் (Tamil)',
  'te': 'తెలుగు (Telugu)',
  'mr': 'मराठी (Marathi)',
  'gu': 'ગુજરાતી (Gujarati)',
  'kn': 'ಕನ್ನಡ (Kannada)',
  'ml': 'മലയാളം (Malayalam)',
  'pa': 'ਪੰਜਾਬੀ (Punjabi)',
};

class LanguageSelectionScreen extends ConsumerStatefulWidget {
  const LanguageSelectionScreen({super.key});

  @override
  ConsumerState<LanguageSelectionScreen> createState() => _LanguageSelectionScreenState();
}

class _LanguageSelectionScreenState extends ConsumerState<LanguageSelectionScreen> {
  String _selected = 'en';
  String _search = '';
  bool _saving = false;

  Future<void> _confirm() async {
    setState(() => _saving = true);
    final db = ref.read(localDbProvider);
    await db.setFlag('language_v1', 'true');
    await db.setFlag('language_code', _selected);
    ref.invalidate(onboardingStateProvider);
  }

  @override
  Widget build(BuildContext context) {
    final entries = kSupportedLanguages.entries
        .where((e) => _search.isEmpty || e.value.toLowerCase().contains(_search.toLowerCase()))
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Preferred language')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.l, AppSpacing.xl, AppSpacing.m),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Choose your language', style: AppType.headlineLarge),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'NutriMind will show scan results, meal plans, and guidance in this language.',
                    style: AppType.bodyMedium.copyWith(color: context.colors.subtle),
                  ),
                  const SizedBox(height: AppSpacing.l),
                  TextField(
                    onChanged: (v) => setState(() => _search = v),
                    decoration: const InputDecoration(
                      hintText: 'Search languages',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: entries.length,
                itemBuilder: (context, i) {
                  final entry = entries[i];
                  final selected = entry.key == _selected;
                  return RadioListTile<String>(
                    value: entry.key,
                    // ignore: deprecated_member_use
                    groupValue: _selected,
                    // ignore: deprecated_member_use
                    onChanged: (v) => setState(() => _selected = v!),
                    title: Text(entry.value, style: AppType.bodyLarge),
                    activeColor: context.colors.primary,
                    selected: selected,
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: FilledButton(
                onPressed: _saving ? null : _confirm,
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

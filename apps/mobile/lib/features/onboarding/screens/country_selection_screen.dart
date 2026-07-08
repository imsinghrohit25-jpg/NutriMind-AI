import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

import '../../../core/design_system/tokens.dart';
import '../../../core/network/api_client.dart';
import '../../../core/offline/local_db.dart';

// Country onboarding v2 (Phase 10, `global.p10.country_onboarding_v2`) — lets the user confirm
// or override the auto-detected country before profile setup, and persists the choice
// server-side (GET/POST /v1/onboarding/country) so it survives reinstalls/new devices, not just
// this device's SharedPreferences. Stored as 'country_v2' flag, gates entry the same way
// consent/disclaimer already do.

class CountrySelectionScreen extends ConsumerStatefulWidget {
  const CountrySelectionScreen({super.key});

  @override
  ConsumerState<CountrySelectionScreen> createState() => _CountrySelectionScreenState();
}

class _CountrySelectionScreenState extends ConsumerState<CountrySelectionScreen> {
  late Future<_CountryOnboardingData> _future;
  bool _saving = false;
  String? _error;
  bool _pickingDifferent = false;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _future = _fetchSuggestion();
  }

  Future<_CountryOnboardingData> _fetchSuggestion() async {
    final client = ref.read(apiClientProvider);
    final resp = await client.get<Map<String, dynamic>>('/v1/onboarding/country');
    final data = resp.data!['data'] as Map<String, dynamic>;
    final suggested = CountryProfile.fromJson(data['suggested'] as Map<String, dynamic>);
    final countries = (data['countries'] as List)
        .cast<Map<String, dynamic>>()
        .map(CountryProfile.fromJson)
        .toList()
      ..sort((a, b) => a.displayName.compareTo(b.displayName));
    return _CountryOnboardingData(suggested: suggested, countries: countries);
  }

  Future<void> _confirm(CountryProfile chosen) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      await client.post<Map<String, dynamic>>(
        '/v1/onboarding/country',
        data: {'isoCode': chosen.isoCode},
      );
      await ref.read(countryProfileProvider.notifier).setOverride(chosen.isoCode);

      final db = ref.read(localDbProvider);
      await db.setFlag('country_v2', 'true');
      ref.invalidate(onboardingStateProvider);
    } catch (e) {
      setState(() {
        _error = 'Could not save your country. Please check your connection and try again.';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Confirm your country')),
      body: SafeArea(
        child: FutureBuilder<_CountryOnboardingData>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError || !snapshot.hasData) {
              return _ErrorState(onRetry: () => setState(() => _future = _fetchSuggestion()));
            }
            final data = snapshot.data!;
            return _pickingDifferent
                ? CountryPickerList(
                    countries: data.countries,
                    search: _search,
                    onSearchChanged: (v) => setState(() => _search = v),
                    onSelected: _saving ? null : _confirm,
                    onBack: () => setState(() => _pickingDifferent = false),
                  )
                : CountrySuggestionView(
                    suggested: data.suggested,
                    saving: _saving,
                    error: _error,
                    onConfirm: () => _confirm(data.suggested),
                    onPickDifferent: () => setState(() => _pickingDifferent = true),
                  );
          },
        ),
      ),
    );
  }
}

class _CountryOnboardingData {
  const _CountryOnboardingData({required this.suggested, required this.countries});
  final CountryProfile suggested;
  final List<CountryProfile> countries;
}

class CountrySuggestionView extends StatelessWidget {
  const CountrySuggestionView({
    super.key,
    required this.suggested,
    required this.saving,
    required this.error,
    required this.onConfirm,
    required this.onPickDifferent,
  });

  final CountryProfile suggested;
  final bool saving;
  final String? error;
  final VoidCallback onConfirm;
  final VoidCallback onPickDifferent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('We think you\'re in', style: AppType.bodyMedium.copyWith(color: AppColors.onSurface)),
          const SizedBox(height: AppSpacing.s),
          Text(suggested.displayName, style: AppType.headlineLarge.copyWith(color: AppColors.primary)),
          const SizedBox(height: AppSpacing.m),
          Text(
            'This sets your allergen labeling rules, nutrition reference values, and default language.',
            style: AppType.bodyMedium.copyWith(color: AppColors.onSurface),
          ),
          if (error != null) ...[
            const SizedBox(height: AppSpacing.l),
            Text(error!, style: AppType.bodyMedium.copyWith(color: AppColors.warning)),
          ],
          const SizedBox(height: AppSpacing.xl),
          FilledButton(
            onPressed: saving ? null : onConfirm,
            child: saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Yes, this is right'),
          ),
          const SizedBox(height: AppSpacing.m),
          TextButton(
            onPressed: saving ? null : onPickDifferent,
            child: const Text('Choose a different country'),
          ),
        ],
      ),
    );
  }
}

class CountryPickerList extends StatelessWidget {
  const CountryPickerList({
    super.key,
    required this.countries,
    required this.search,
    required this.onSearchChanged,
    required this.onSelected,
    required this.onBack,
  });

  final List<CountryProfile> countries;
  final String search;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<CountryProfile>? onSelected;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final filtered = search.isEmpty
        ? countries
        : countries.where((c) => c.displayName.toLowerCase().contains(search.toLowerCase())).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.m),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: onBack),
              Expanded(
                child: TextField(
                  onChanged: onSearchChanged,
                  decoration: const InputDecoration(
                    hintText: 'Search countries',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: filtered.length,
            itemBuilder: (context, i) {
              final country = filtered[i];
              return ListTile(
                title: Text(country.displayName),
                subtitle: Text(country.isoCode),
                onTap: onSelected == null ? null : () => onSelected!(country),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AppColors.warning),
            const SizedBox(height: AppSpacing.m),
            Text(
              'Could not load country options. Check your connection and try again.',
              textAlign: TextAlign.center,
              style: AppType.bodyMedium.copyWith(color: AppColors.onSurface),
            ),
            const SizedBox(height: AppSpacing.l),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

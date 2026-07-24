import '../../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

import '../../../core/design_system/app_palette.dart';
import '../../../core/design_system/tokens.dart';
import '../../../core/network/api_client.dart';
import '../../../core/offline/local_db.dart';
import '../../../core/telemetry/telemetry.dart';

// Country onboarding v2 (Phase 10, `global.p10.country_onboarding_v2`) — lets the user confirm
// or override the auto-detected country before profile setup, and persists the choice
// server-side (GET/POST /v1/onboarding/country) so it survives reinstalls/new devices, not just
// this device's SharedPreferences. Stored as 'country_v2' flag, gates entry the same way
// consent/disclaimer already do.
//
// Rewritten: the suggestion and country list used to come ONLY from the backend API
// (`GET /v1/onboarding/country`) — a hard, blocking network dependency on an onboarding gate
// that every single user must pass through. If that request hung (e.g. `API_BASE_URL`
// unreachable — the default `10.0.2.2:3000` only resolves from inside the Android emulator,
// never a real device or a build where the backend simply isn't running) the FutureBuilder
// never left its loading state: this was the literal "onboarding hangs on the Country screen
// with an infinite loader" bug. The suggestion now comes from `nutrimind_country_engine`'s own
// local resolution chain (SIM/locale/stored override — see resolution_chain.dart), which is
// synchronous-fast and cannot hang or fail on network. The backend POST in `_confirm()` is now
// best-effort: it's still attempted (real value — server-side persistence across devices/
// reinstalls), but a failure or timeout never blocks the user from proceeding, it's just logged.

final _log = getLogger('onboarding.country');

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
    _future = _resolveSuggestion();
  }

  /// Fully local — no network call, cannot hang or fail on connectivity. This is the FIRST real
  /// call to `countryProfileProvider.notifier.init()` anywhere in the mobile app (it existed
  /// since Phase 10 but was never actually invoked — only `setOverride()` was, meaning the
  /// provider's state was stuck at its hardcoded India default until now).
  Future<_CountryOnboardingData> _resolveSuggestion() async {
    _log.info('Resolving suggested country locally (SIM/locale/stored — no network)');
    await ref.read(countryProfileProvider.notifier).init();
    final suggested = ref.read(countryProfileProvider);
    final countries = List<CountryProfile>.from(CountryRegistry.all)
      ..sort((a, b) => a.displayName.compareTo(b.displayName));
    _log.info('Suggested country resolved: ${suggested.isoCode} (${suggested.displayName})');
    return _CountryOnboardingData(suggested: suggested, countries: countries);
  }

  Future<void> _confirm(CountryProfile chosen) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    _log.info('Confirming country selection: ${chosen.isoCode}');

    // Local state is the source of truth for unblocking onboarding — always applied first,
    // never gated on network.
    await ref.read(countryProfileProvider.notifier).setOverride(chosen.isoCode);
    final db = ref.read(localDbProvider);
    await db.setFlag('country_v2', 'true');

    // Best-effort server sync: real value (cross-device persistence) but never a hard
    // dependency — a slow/unreachable backend must never block this onboarding gate.
    try {
      final client = ref.read(apiClientProvider);
      await client
          .post<Map<String, dynamic>>('/v1/onboarding/country', data: {'isoCode': chosen.isoCode})
          .timeout(const Duration(seconds: 8)); // design-governance:ignore: network timeout, not an animation
      _log.info('Server-side country sync succeeded for ${chosen.isoCode}');
    } catch (e, st) {
      _log.warning('Server-side country sync failed (continuing anyway — local state already saved)', e, st);
    }

    if (!mounted) return;
    ref.invalidate(onboardingStateProvider);
    setState(() => _saving = false);
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
              return const Center(child: AppLoader());
            }
            if (snapshot.hasError || !snapshot.hasData) {
              _log.warning('Local country resolution failed unexpectedly', snapshot.error);
              return _ErrorState(onRetry: () => setState(() => _future = _resolveSuggestion()));
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
          Text('We think you\'re in', style: AppType.bodyMedium.copyWith(color: context.colors.onSurface)),
          const SizedBox(height: AppSpacing.s),
          Text(suggested.displayName, style: AppType.headlineLarge.copyWith(color: context.colors.primary)),
          const SizedBox(height: AppSpacing.m),
          Text(
            'This sets your allergen labeling rules, nutrition reference values, and default language.',
            style: AppType.bodyMedium.copyWith(color: context.colors.onSurface),
          ),
          if (error != null) ...[
            const SizedBox(height: AppSpacing.l),
            Text(error!, style: AppType.bodyMedium.copyWith(color: context.colors.warning)),
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
            Icon(Icons.error_outline, size: 48, color: context.colors.warning),
            const SizedBox(height: AppSpacing.m),
            Text(
              'Something went wrong resolving your country. Please try again.',
              textAlign: TextAlign.center,
              style: AppType.bodyMedium.copyWith(color: context.colors.onSurface),
            ),
            const SizedBox(height: AppSpacing.l),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

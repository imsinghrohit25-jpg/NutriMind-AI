import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

import 'code_switching.dart';
import 'localization_config.dart';

/// Phase 2 feature flags state.
/// Kept as a separate provider so it can be updated independently of the locale.
class LocalizationFlags {
  const LocalizationFlags({
    this.rtlEnabled = false,
    this.numeralRenderingEnabled = false,
    this.tierBEnabled = false,
    this.codeSwitchingEnabled = false,
  });

  final bool rtlEnabled;
  final bool numeralRenderingEnabled;
  final bool tierBEnabled;
  final bool codeSwitchingEnabled;

  LocalizationFlags copyWith({
    bool? rtlEnabled,
    bool? numeralRenderingEnabled,
    bool? tierBEnabled,
    bool? codeSwitchingEnabled,
  }) => LocalizationFlags(
    rtlEnabled: rtlEnabled ?? this.rtlEnabled,
    numeralRenderingEnabled: numeralRenderingEnabled ?? this.numeralRenderingEnabled,
    tierBEnabled: tierBEnabled ?? this.tierBEnabled,
    codeSwitchingEnabled: codeSwitchingEnabled ?? this.codeSwitchingEnabled,
  );
}

/// Holds active Phase 2 flag state. Updated by app after flag sync.
/// All flags default false → backward compatible with India users.
final localizationFlagsProvider = StateProvider<LocalizationFlags>(
  (_) => const LocalizationFlags(),
);

/// Riverpod notifier — derives LocalizationConfig from CountryProfile + flags.
/// Rebuilds automatically when either country or flags change.
class LocalizationEngineNotifier extends Notifier<LocalizationConfig> {
  @override
  LocalizationConfig build() {
    final country = ref.watch(countryProfileProvider);
    final flags   = ref.watch(localizationFlagsProvider);
    return _derive(country, flags);
  }

  LocalizationConfig _derive(CountryProfile profile, LocalizationFlags flags) {
    final config = LocalizationConfig.fromProfile(
      profile,
      rtlEnabled:              flags.rtlEnabled,
      numeralRenderingEnabled: flags.numeralRenderingEnabled,
      tierBEnabled:            flags.tierBEnabled,
    );

    // Keep code-switching in sync.
    Future.microtask(() {
      if (!ref.exists(codeSwitchingProvider)) return;
      ref.read(codeSwitchingProvider.notifier).state = CodeSwitchingConfig(
        primary:  config.locale,
        secondary: config.locale.languageCode != 'en' ? const Locale('en') : null,
        enabled: flags.codeSwitchingEnabled && config.locale.languageCode != 'en',
      );
    });

    return config;
  }
}

/// Primary provider — consumed by MaterialApp and locale-aware widgets.
final localizationConfigProvider =
    NotifierProvider<LocalizationEngineNotifier, LocalizationConfig>(
  LocalizationEngineNotifier.new,
);

/// Convenience: just the Locale.
final activeLocaleProvider = Provider<Locale>(
  (ref) => ref.watch(localizationConfigProvider).locale,
);

/// Convenience: TextDirection for Directionality wrapping.
final activeTextDirectionProvider = Provider<TextDirection>(
  (ref) => ref.watch(localizationConfigProvider).textDirection,
);

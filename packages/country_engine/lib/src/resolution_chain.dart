// Country resolution chain — 6 steps, first non-null result wins.
//
// Flutter/mobile-side resolution order:
//  Step 1: Stored explicit override (SharedPreferences)
//  Step 2: API profile preferred_country (loaded at startup)
//  Step 3: SIM MCC (via SimInfoProvider — requires telephony permission)
//  Step 4: OS locale region (Platform.localeName e.g. 'en_US' → 'US')
//  Step 5: Stored last-known country (from previous successful resolution)
//  Step 6: GLOBAL fallback

import 'dart:io' show Platform;
import 'country_profile.dart';
import 'country_registry.dart';
import 'sim_info_provider.dart';

/// Result of a resolution attempt.
class CountryResolutionResult {
  const CountryResolutionResult({
    required this.profile,
    required this.resolvedBy,
    required this.candidate,
  });
  final CountryProfile profile;
  final String         resolvedBy;
  final String         candidate;

  @override
  String toString() => 'CountryResolution($resolvedBy → $candidate → ${profile.isoCode})';
}

/// Resolves CountryProfile at session start using the 6-step chain.
class CountryResolutionChain {
  const CountryResolutionChain({
    this.simInfoProvider = const NullSimInfoProvider(),
  });

  final SimInfoProvider simInfoProvider;

  /// Resolve the best CountryProfile for the current session.
  ///
  /// [storedOverride] — ISO code from user profile settings (Step 1)
  /// [apiProfileCountry] — ISO code from API user_profiles.preferred_country (Step 2)
  /// [osLocale] — raw locale string from Platform.localeName (Step 4 input)
  /// [storedLastKnown] — last resolved ISO code, stored across sessions (Step 5)
  Future<CountryResolutionResult> resolve({
    String? storedOverride,
    String? apiProfileCountry,
    String? osLocale,
    String? storedLastKnown,
  }) async {
    // Step 1: Stored explicit override
    if (storedOverride != null && storedOverride.isNotEmpty) {
      final p = CountryRegistry.lookup(storedOverride);
      if (p != null) {
        return CountryResolutionResult(
          profile: p, resolvedBy: 'stored-override', candidate: storedOverride,
        );
      }
    }

    // Step 2: API profile preferred_country
    if (apiProfileCountry != null && apiProfileCountry.isNotEmpty) {
      final p = CountryRegistry.lookup(apiProfileCountry);
      if (p != null) {
        return CountryResolutionResult(
          profile: p, resolvedBy: 'api-profile', candidate: apiProfileCountry,
        );
      }
    }

    // Step 3: SIM MCC
    final mcc = await simInfoProvider.getMcc();
    if (mcc != null) {
      final p = CountryRegistry.lookupByMcc(mcc);
      if (p != null) {
        return CountryResolutionResult(
          profile: p, resolvedBy: 'sim-mcc', candidate: mcc,
        );
      }
    }

    // Step 4: OS locale region
    final localeName = osLocale ?? _platformLocale();
    if (localeName != null) {
      final region = regionFromLocale(localeName);
      if (region != null) {
        final p = CountryRegistry.lookup(region);
        if (p != null) {
          return CountryResolutionResult(
            profile: p, resolvedBy: 'os-locale', candidate: region,
          );
        }
      }
    }

    // Step 5: Stored last-known
    if (storedLastKnown != null && storedLastKnown.isNotEmpty) {
      final p = CountryRegistry.lookup(storedLastKnown);
      if (p != null) {
        return CountryResolutionResult(
          profile: p, resolvedBy: 'stored-last-known', candidate: storedLastKnown,
        );
      }
    }

    // Step 6: GLOBAL fallback
    return const CountryResolutionResult(
      profile:     CountryProfile.global,
      resolvedBy:  'fallback',
      candidate:   'GLOBAL',
    );
  }

  static String? _platformLocale() {
    try {
      return Platform.localeName; // e.g. 'en_US', 'hi_IN'
    } catch (_) {
      return null; // not available on web
    }
  }
}

// Riverpod providers for CountryProfile.
// The countryProfileProvider is the single source of truth for country context.
// Every feature provider that needs country reads this provider.

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'country_profile.dart';
import 'country_registry.dart';
import 'resolution_chain.dart';
import 'sim_info_provider.dart';

const _kStoredOverrideKey   = 'nutrimind.country.override';
const _kStoredLastKnownKey  = 'nutrimind.country.last_known';
const _kStoredProfileCache  = 'nutrimind.country.profile_cache';

/// Notifier that owns the resolved CountryProfile for the session.
///
/// Initialise via:
///   final container = ProviderContainer();
///   await container.read(countryProfileNotifierProvider.notifier).init(
///     apiProfileCountry: 'IN',  // from user profile API response
///   );
class CountryProfileNotifier extends Notifier<CountryProfile> {
  @override
  CountryProfile build() {
    // Start with India (feature flag off default); init() will update this.
    return CountryProfile.india;
  }

  final _chain = const CountryResolutionChain(
    simInfoProvider: NullSimInfoProvider(), // Phase 6 will inject the real provider
  );

  /// Call once after app startup when user profile data is available.
  Future<void> init({String? apiProfileCountry}) async {
    final prefs = await SharedPreferences.getInstance();

    final storedOverride   = prefs.getString(_kStoredOverrideKey);
    final storedLastKnown  = prefs.getString(_kStoredLastKnownKey);

    final result = await _chain.resolve(
      storedOverride:    storedOverride,
      apiProfileCountry: apiProfileCountry,
      storedLastKnown:   storedLastKnown,
    );

    state = result.profile;

    // Persist the resolved country for offline resilience (Step 5 input next session)
    await prefs.setString(_kStoredLastKnownKey, result.profile.isoCode);
    await prefs.setString(_kStoredProfileCache, jsonEncode(result.profile.toJson()));

    debugPrint('[country] resolved via ${result.resolvedBy}: ${result.profile.isoCode}');
  }

  /// Explicitly override the country (user settings screen).
  /// Pass null to clear the override and re-run auto-detection.
  Future<void> setOverride(String? isoCode) async {
    final prefs = await SharedPreferences.getInstance();
    if (isoCode == null) {
      await prefs.remove(_kStoredOverrideKey);
      await init();
    } else {
      final profile = CountryRegistry.lookup(isoCode);
      if (profile == null) return; // unknown country — ignore
      await prefs.setString(_kStoredOverrideKey, isoCode);
      state = profile;
    }
  }

  /// Called by TravelWatcher when device country appears to have changed.
  Future<void> handleTravelDetected(String newIsoCode) async {
    final profile = CountryRegistry.lookup(newIsoCode);
    if (profile == null || profile.isoCode == state.isoCode) return;

    // Update state — UI layer shows a travel transition banner.
    state = profile;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kStoredLastKnownKey, newIsoCode);
    await prefs.setString(_kStoredProfileCache, jsonEncode(profile.toJson()));
  }
}

/// The primary country provider. Expose via [ref.watch] in feature providers.
final countryProfileProvider =
    NotifierProvider<CountryProfileNotifier, CountryProfile>(
  CountryProfileNotifier.new,
);

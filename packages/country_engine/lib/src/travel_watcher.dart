// Travel watcher — detects country changes on app resume.
// When the OS locale region changes between sessions, prompts the user
// to confirm whether they've travelled.
//
// Usage: bind TravelWatcher as a WidgetsBindingObserver in the root widget.

import 'dart:io' show Platform;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'country_provider.dart';
import 'country_registry.dart';

class TravelWatcher with WidgetsBindingObserver {
  TravelWatcher({required this.ref});

  final Ref ref;

  /// The OS locale at last check.
  String? _lastLocale;

  void attach() {
    WidgetsBinding.instance.addObserver(this);
    _lastLocale = _platformLocale();
  }

  void detach() {
    WidgetsBinding.instance.removeObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState lifecycleState) {
    if (lifecycleState != AppLifecycleState.resumed) return;
    _checkForTravel();
  }

  void _checkForTravel() {
    final current = _platformLocale();
    if (current == null || current == _lastLocale) return;

    _lastLocale = current;

    // Extract region from locale (e.g. 'en_US' → 'US')
    final parts = current.split(RegExp(r'[-_]'));
    String? region;
    for (int i = parts.length - 1; i >= 1; i--) {
      if (RegExp(r'^[A-Za-z]{2}$').hasMatch(parts[i])) {
        region = parts[i].toUpperCase();
        break;
      }
    }
    if (region == null) return;

    final profile = CountryRegistry.lookup(region);
    if (profile == null) return;

    final currentCountry = ref.read(countryProfileProvider);
    if (profile.isoCode == currentCountry.isoCode) return;

    // Notify the provider — UI layer decides whether to show travel banner
    ref.read(countryProfileProvider.notifier).handleTravelDetected(profile.isoCode);
  }

  static String? _platformLocale() {
    try {
      return Platform.localeName;
    } catch (_) {
      return null;
    }
  }
}

/// Whether the user has travelled (country changed on resume).
/// UI widgets watch this to show the travel transition banner.
final travelDetectedProvider = StateProvider<bool>((ref) => false);

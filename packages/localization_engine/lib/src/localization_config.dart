import 'package:flutter/widgets.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

import 'numeral_system.dart';
import 'rtl_helper.dart';
import 'tier_classifier.dart';

/// Fully resolved localization configuration for the current session.
/// Derived from CountryProfile + active feature flags.
/// Immutable — replace the whole object on locale change.
class LocalizationConfig {
  const LocalizationConfig({
    required this.locale,
    required this.textDirection,
    required this.numeralSystem,
    required this.translationTier,
    required this.rtlEnabled,
    required this.numeralRenderingEnabled,
    required this.tierBEnabled,
  });

  /// BCP-47 locale string used to set MaterialApp.locale (e.g. 'hi', 'ar', 'en').
  final Locale locale;

  /// Resolved text direction — respects profileRtl AND the language tag.
  final TextDirection textDirection;

  /// Numeral system for this locale (western when flag OFF).
  final NumeralSystem numeralSystem;

  /// Which translation tier this language falls in.
  final TranslationTier translationTier;

  /// Whether RTL support is feature-flag active.
  final bool rtlEnabled;

  /// Whether numeral rendering is feature-flag active.
  final bool numeralRenderingEnabled;

  /// Whether Tier B languages are accessible.
  final bool tierBEnabled;

  bool get isRtl => textDirection == TextDirection.rtl;

  /// Builds a LocalizationConfig from a CountryProfile and flag state.
  factory LocalizationConfig.fromProfile(
    CountryProfile profile, {
    required bool rtlEnabled,
    required bool numeralRenderingEnabled,
    required bool tierBEnabled,
  }) {
    final langCode = profile.locale.split(RegExp(r'[-_]')).first;
    final system   = resolveNumeralSystem(langCode, enabled: numeralRenderingEnabled);
    final dir      = rtlEnabled
        ? textDirectionFor(languageCode: langCode, profileRtl: profile.rtl)
        : TextDirection.ltr;

    return LocalizationConfig(
      locale:                   Locale(langCode),
      textDirection:            dir,
      numeralSystem:            system,
      translationTier:          tierFor(langCode),
      rtlEnabled:               rtlEnabled,
      numeralRenderingEnabled:  numeralRenderingEnabled,
      tierBEnabled:             tierBEnabled,
    );
  }

  /// Neutral English config used before flags or profile have loaded.
  static const LocalizationConfig defaults = LocalizationConfig(
    locale:                   Locale('en'),
    textDirection:            TextDirection.ltr,
    numeralSystem:            NumeralSystem.western,
    translationTier:          TranslationTier.tierA,
    rtlEnabled:               false,
    numeralRenderingEnabled:  false,
    tierBEnabled:             false,
  );

  @override
  bool operator ==(Object other) =>
      other is LocalizationConfig &&
      other.locale == locale &&
      other.textDirection == textDirection &&
      other.numeralSystem == numeralSystem &&
      other.rtlEnabled == rtlEnabled &&
      other.numeralRenderingEnabled == numeralRenderingEnabled;

  @override
  int get hashCode => Object.hash(
      locale, textDirection, numeralSystem, rtlEnabled, numeralRenderingEnabled);
}

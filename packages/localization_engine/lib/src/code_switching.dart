import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Code-switching configuration — allows mixing a primary and secondary locale.
/// Common for Indian users who mix English with their regional language.
/// Gated behind global.p2.code_switching.
class CodeSwitchingConfig {
  const CodeSwitchingConfig({
    required this.primary,
    this.secondary,
    required this.enabled,
  });

  /// Primary locale for all app strings.
  final Locale primary;

  /// Secondary locale — when set, English terms in categories like nutrition
  /// labels (Protein, Sodium) may be shown in primary with English in brackets.
  /// e.g. "प्रोटीन (Protein)"
  final Locale? secondary;

  /// Whether code-switching is active (global.p2.code_switching flag AND
  /// user has a secondary locale preference set).
  final bool enabled;

  const CodeSwitchingConfig.off(Locale locale)
      : primary = locale,
        secondary = null,
        enabled = false;
}

/// Riverpod provider — holds active CodeSwitchingConfig.
/// Reads from localization config; updated by [LocalizationEngineNotifier].
final codeSwitchingProvider = StateProvider<CodeSwitchingConfig>(
  (ref) => CodeSwitchingConfig.off(const Locale('en')),
);

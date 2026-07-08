import 'package:flutter/widgets.dart';

/// Language tags that are always RTL, regardless of CountryProfile.rtl.
const _rtlLanguages = {'ar', 'he', 'fa', 'ur', 'dv', 'ps', 'ug', 'yi', 'ks', 'sd'};

/// Returns the [TextDirection] for the given [languageCode].
/// Consult CountryProfile.rtl first; fall back to the language tag whitelist.
TextDirection textDirectionFor({
  required String languageCode,
  bool profileRtl = false,
}) {
  if (profileRtl || _rtlLanguages.contains(languageCode.toLowerCase())) {
    return TextDirection.rtl;
  }
  return TextDirection.ltr;
}

/// Whether the given locale string (BCP-47) is RTL.
bool isRtlLocale(String locale) {
  final lang = locale.split(RegExp(r'[-_]')).first.toLowerCase();
  return _rtlLanguages.contains(lang);
}

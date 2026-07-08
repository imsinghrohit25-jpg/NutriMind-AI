// CountryProfile — central configuration spine.
// Filled by Phase 1. Skeleton only.

/// Tier of country support.
enum CountryTier { tier1, tier2, fallback }

/// Immutable country configuration resolved once per session.
/// Every service receives this via dependency injection — never reads locale directly.
class CountryProfile {
  const CountryProfile({
    required this.isoCode,
    required this.tier,
    required this.displayName,
    required this.locale,
    required this.currencyCode,
    required this.rtl,
  });

  final String      isoCode;
  final CountryTier tier;
  final String      displayName;
  final String      locale;
  final String      currencyCode;
  final bool        rtl;

  /// The global fallback profile — used when no country can be resolved.
  static const CountryProfile global = CountryProfile(
    isoCode:     'GLOBAL',
    tier:        CountryTier.fallback,
    displayName: 'Global',
    locale:      'en',
    currencyCode:'USD',
    rtl:         false,
  );

  @override
  String toString() => 'CountryProfile($isoCode, $tier)';
}

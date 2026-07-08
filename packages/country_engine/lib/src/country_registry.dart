// Country registry — Phase 1 will seed all ISO-3166 entries.
// Skeleton only.

import 'country_profile.dart';

/// Static registry of known CountryProfiles.
/// Phase 1 replaces the stub list below with all ISO-3166 entries + Tier assignments.
abstract final class CountryRegistry {
  static const Map<String, CountryProfile> _profiles = {
    'IN': CountryProfile(
      isoCode: 'IN', tier: CountryTier.tier1, displayName: 'India',
      locale: 'en_IN', currencyCode: 'INR', rtl: false,
    ),
    'US': CountryProfile(
      isoCode: 'US', tier: CountryTier.tier1, displayName: 'United States',
      locale: 'en_US', currencyCode: 'USD', rtl: false,
    ),
    'GB': CountryProfile(
      isoCode: 'GB', tier: CountryTier.tier1, displayName: 'United Kingdom',
      locale: 'en_GB', currencyCode: 'GBP', rtl: false,
    ),
    'AE': CountryProfile(
      isoCode: 'AE', tier: CountryTier.tier1, displayName: 'UAE',
      locale: 'ar_AE', currencyCode: 'AED', rtl: true,
    ),
    'SG': CountryProfile(
      isoCode: 'SG', tier: CountryTier.tier1, displayName: 'Singapore',
      locale: 'en_SG', currencyCode: 'SGD', rtl: false,
    ),
    'AU': CountryProfile(
      isoCode: 'AU', tier: CountryTier.tier1, displayName: 'Australia',
      locale: 'en_AU', currencyCode: 'AUD', rtl: false,
    ),
    'CA': CountryProfile(
      isoCode: 'CA', tier: CountryTier.tier1, displayName: 'Canada',
      locale: 'en_CA', currencyCode: 'CAD', rtl: false,
    ),
    'DE': CountryProfile(
      isoCode: 'DE', tier: CountryTier.tier1, displayName: 'Germany',
      locale: 'de_DE', currencyCode: 'EUR', rtl: false,
    ),
  };

  static CountryProfile? lookup(String isoCode) => _profiles[isoCode.toUpperCase()];

  static CountryProfile lookupOrFallback(String isoCode) =>
      lookup(isoCode) ?? CountryProfile.global;
}

// Country registry — 8 Tier-1, 17 Tier-2, GLOBAL fallback.
// Mirrors apps/api/src/country/registry.ts.
// Adding a new country: add entry here + seed rule pack in Phase 4. No other changes needed.

import 'country_profile.dart';

abstract final class CountryRegistry {
  // ── Tier 1 ────────────────────────────────────────────────────────────────

  static const _tier1 = <CountryProfile>[
    CountryProfile(
      isoCode: 'IN', tier: CountryTier.tier1, displayName: 'India',
      locale: 'en_IN', currencyCode: 'INR', rtl: false,
      allergenRegime: AllergenRegime.fssai8, nutritionStandard: NutritionStandard.icmrNin,
      callingCode: '+91', mccList: ['404', '405'],
    ),
    CountryProfile(
      isoCode: 'US', tier: CountryTier.tier1, displayName: 'United States',
      locale: 'en_US', currencyCode: 'USD', rtl: false,
      allergenRegime: AllergenRegime.fda9Sesame, nutritionStandard: NutritionStandard.usDri,
      callingCode: '+1', mccList: ['310', '311', '312', '313', '314', '315', '316'],
    ),
    CountryProfile(
      isoCode: 'GB', tier: CountryTier.tier1, displayName: 'United Kingdom',
      locale: 'en_GB', currencyCode: 'GBP', rtl: false,
      allergenRegime: AllergenRegime.eu14, nutritionStandard: NutritionStandard.ukSacn,
      callingCode: '+44', mccList: ['234', '235'],
    ),
    CountryProfile(
      isoCode: 'AE', tier: CountryTier.tier1, displayName: 'UAE',
      locale: 'ar_AE', currencyCode: 'AED', rtl: true,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+971', mccList: ['424', '430'],
    ),
    CountryProfile(
      isoCode: 'SG', tier: CountryTier.tier1, displayName: 'Singapore',
      locale: 'en_SG', currencyCode: 'SGD', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.hpbSg,
      callingCode: '+65', mccList: ['525'],
    ),
    CountryProfile(
      isoCode: 'AU', tier: CountryTier.tier1, displayName: 'Australia',
      locale: 'en_AU', currencyCode: 'AUD', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.nhmrc,
      callingCode: '+61', mccList: ['505'],
    ),
    CountryProfile(
      isoCode: 'CA', tier: CountryTier.tier1, displayName: 'Canada',
      locale: 'en_CA', currencyCode: 'CAD', rtl: false,
      allergenRegime: AllergenRegime.fda9Sesame, nutritionStandard: NutritionStandard.usDri,
      callingCode: '+1', mccList: ['302'],
    ),
    CountryProfile(
      isoCode: 'DE', tier: CountryTier.tier1, displayName: 'Germany',
      locale: 'de_DE', currencyCode: 'EUR', rtl: false,
      allergenRegime: AllergenRegime.eu14, nutritionStandard: NutritionStandard.efsa,
      callingCode: '+49', mccList: ['262'],
    ),
  ];

  // ── Tier 2 ────────────────────────────────────────────────────────────────

  static const _tier2 = <CountryProfile>[
    CountryProfile(
      isoCode: 'JP', tier: CountryTier.tier2, displayName: 'Japan',
      locale: 'ja_JP', currencyCode: 'JPY', rtl: false,
      allergenRegime: AllergenRegime.jp8, nutritionStandard: NutritionStandard.jpDri,
      callingCode: '+81', mccList: ['440', '441'],
    ),
    CountryProfile(
      isoCode: 'FR', tier: CountryTier.tier2, displayName: 'France',
      locale: 'fr_FR', currencyCode: 'EUR', rtl: false,
      allergenRegime: AllergenRegime.eu14, nutritionStandard: NutritionStandard.efsa,
      callingCode: '+33', mccList: ['208'],
    ),
    CountryProfile(
      isoCode: 'KR', tier: CountryTier.tier2, displayName: 'South Korea',
      locale: 'ko_KR', currencyCode: 'KRW', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+82', mccList: ['450'],
    ),
    CountryProfile(
      isoCode: 'BR', tier: CountryTier.tier2, displayName: 'Brazil',
      locale: 'pt_BR', currencyCode: 'BRL', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+55', mccList: ['724'],
    ),
    CountryProfile(
      isoCode: 'MX', tier: CountryTier.tier2, displayName: 'Mexico',
      locale: 'es_MX', currencyCode: 'MXN', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+52', mccList: ['334'],
    ),
    CountryProfile(
      isoCode: 'ID', tier: CountryTier.tier2, displayName: 'Indonesia',
      locale: 'id_ID', currencyCode: 'IDR', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+62', mccList: ['510'],
    ),
    CountryProfile(
      isoCode: 'TH', tier: CountryTier.tier2, displayName: 'Thailand',
      locale: 'th_TH', currencyCode: 'THB', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+66', mccList: ['520'],
    ),
    CountryProfile(
      isoCode: 'MY', tier: CountryTier.tier2, displayName: 'Malaysia',
      locale: 'ms_MY', currencyCode: 'MYR', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+60', mccList: ['502'],
    ),
    CountryProfile(
      isoCode: 'PH', tier: CountryTier.tier2, displayName: 'Philippines',
      locale: 'en_PH', currencyCode: 'PHP', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+63', mccList: ['515'],
    ),
    CountryProfile(
      isoCode: 'VN', tier: CountryTier.tier2, displayName: 'Vietnam',
      locale: 'vi_VN', currencyCode: 'VND', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+84', mccList: ['452'],
    ),
    CountryProfile(
      isoCode: 'ZA', tier: CountryTier.tier2, displayName: 'South Africa',
      locale: 'en_ZA', currencyCode: 'ZAR', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+27', mccList: ['655'],
    ),
    CountryProfile(
      isoCode: 'NG', tier: CountryTier.tier2, displayName: 'Nigeria',
      locale: 'en_NG', currencyCode: 'NGN', rtl: false,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+234', mccList: ['621'],
    ),
    CountryProfile(
      isoCode: 'EG', tier: CountryTier.tier2, displayName: 'Egypt',
      locale: 'ar_EG', currencyCode: 'EGP', rtl: true,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+20', mccList: ['602'],
    ),
    CountryProfile(
      isoCode: 'SA', tier: CountryTier.tier2, displayName: 'Saudi Arabia',
      locale: 'ar_SA', currencyCode: 'SAR', rtl: true,
      allergenRegime: AllergenRegime.whoGlobal, nutritionStandard: NutritionStandard.who,
      callingCode: '+966', mccList: ['420'],
    ),
    CountryProfile(
      isoCode: 'IT', tier: CountryTier.tier2, displayName: 'Italy',
      locale: 'it_IT', currencyCode: 'EUR', rtl: false,
      allergenRegime: AllergenRegime.eu14, nutritionStandard: NutritionStandard.efsa,
      callingCode: '+39', mccList: ['222'],
    ),
    CountryProfile(
      isoCode: 'ES', tier: CountryTier.tier2, displayName: 'Spain',
      locale: 'es_ES', currencyCode: 'EUR', rtl: false,
      allergenRegime: AllergenRegime.eu14, nutritionStandard: NutritionStandard.efsa,
      callingCode: '+34', mccList: ['214'],
    ),
    CountryProfile(
      isoCode: 'NL', tier: CountryTier.tier2, displayName: 'Netherlands',
      locale: 'nl_NL', currencyCode: 'EUR', rtl: false,
      allergenRegime: AllergenRegime.eu14, nutritionStandard: NutritionStandard.efsa,
      callingCode: '+31', mccList: ['204'],
    ),
  ];

  // ── Registry ───────────────────────────────────────────────────────────────

  static final Map<String, CountryProfile> _byIso = {
    for (final p in [..._tier1, ..._tier2]) p.isoCode: p,
  };

  static final Map<String, CountryProfile> _byMcc = {
    for (final p in [..._tier1, ..._tier2])
      for (final mcc in p.mccList) mcc: p,
  };

  static CountryProfile? lookup(String isoCode) =>
      _byIso[isoCode.toUpperCase()];

  static CountryProfile lookupOrGlobal(String isoCode) =>
      lookup(isoCode) ?? CountryProfile.global;

  static CountryProfile? lookupByMcc(String mcc) => _byMcc[mcc];

  static List<CountryProfile> get all => List.unmodifiable([..._tier1, ..._tier2]);
  static List<CountryProfile> get tier1Countries => List.unmodifiable(_tier1);
  static List<CountryProfile> get tier2Countries => List.unmodifiable(_tier2);
}

/// Extract ISO region from a BCP-47 locale string.
/// 'en-US' → 'US', 'en_IN' → 'IN', 'ja' → null.
String? regionFromLocale(String locale) {
  final parts = locale.split(RegExp(r'[-_]'));
  for (int i = parts.length - 1; i >= 1; i--) {
    final part = parts[i];
    if (RegExp(r'^[A-Za-z]{2}$').hasMatch(part)) return part.toUpperCase();
  }
  return null;
}

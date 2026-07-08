// CountryProfile — the central spine of the Global Enterprise Edition.
// Resolved ONCE per session by CountryResolutionChain; injected via Riverpod.
// Must stay in sync with apps/api/src/country/types.ts.

/// Tier of country support.
enum CountryTier {
  /// Full feature set, native data sources, human-reviewed localization.
  tier1,
  /// Core features, machine-translated localization, WHO nutrition standard where applicable.
  tier2,
  /// Global fallback — no country-specific rules.
  fallback,
}

/// Per-country mandatory allergen declaration regime.
enum AllergenRegime {
  /// India — 8 allergens (FSSAI Food Safety Regulations 2023)
  fssai8,
  /// US / Canada — 9 major allergens incl. sesame (FASTER Act 2023)
  fda9Sesame,
  /// EU, UK, CH, NO — 14 allergens (Regulation 1169/2011 Annex II)
  eu14,
  /// Japan — 8 mandatory + 20 recommended
  jp8,
  /// WHO advisory list — used for all other countries
  whoGlobal,
}

// Wire-format strings (apps/api/src/country/types.ts `AllergenRegime` union) — deliberately NOT
// `.name`/`byName()`, whose Dart identifiers (`fssai8`, `whoGlobal`, ...) never matched the
// server's actual values (`FSSAI_8`, `WHO_GLOBAL`, ...). `fromJson()` against a real API
// response would throw before this was added — there was no prior code path that ever
// deserialized server-sent JSON through this model (only a self-consistent SharedPreferences
// round-trip, Dart writing then reading its own `toJson()` output).
const _allergenRegimeWire = <AllergenRegime, String>{
  AllergenRegime.fssai8: 'FSSAI_8',
  AllergenRegime.fda9Sesame: 'FDA_9_SESAME',
  AllergenRegime.eu14: 'EU_14',
  AllergenRegime.jp8: 'JP_8',
  AllergenRegime.whoGlobal: 'WHO_GLOBAL',
};

AllergenRegime _allergenRegimeFromWire(String s) => _allergenRegimeWire.entries
    .firstWhere((e) => e.value == s, orElse: () => const MapEntry(AllergenRegime.whoGlobal, ''))
    .key;

/// Authoritative dietary reference values standard for this country.
enum NutritionStandard {
  icmrNin,  // India — ICMR-NIN 2020
  usDri,    // US / Canada — USDA Dietary Reference Intakes
  ukSacn,   // UK — SACN/COMA values
  efsa,     // EU + EEA — EFSA Dietary Reference Values
  nhmrc,    // Australia / NZ — NHMRC Nutrient Reference Values
  jpDri,    // Japan — 日本人の食事摂取基準
  hpbSg,    // Singapore — Health Promotion Board RNI
  who,      // Global / WHO — all other countries
}

// Wire-format strings (apps/api/src/country/types.ts `NutritionStandard` union) — same
// deliberate explicit mapping as `_allergenRegimeWire` above, same reason.
const _nutritionStandardWire = <NutritionStandard, String>{
  NutritionStandard.icmrNin: 'ICMR_NIN',
  NutritionStandard.usDri: 'US_DRI',
  NutritionStandard.ukSacn: 'UK_SACN',
  NutritionStandard.efsa: 'EFSA',
  NutritionStandard.nhmrc: 'NHMRC',
  NutritionStandard.jpDri: 'JP_DRI',
  NutritionStandard.hpbSg: 'HPB_SG',
  NutritionStandard.who: 'WHO',
};

NutritionStandard _nutritionStandardFromWire(String s) => _nutritionStandardWire.entries
    .firstWhere((e) => e.value == s, orElse: () => const MapEntry(NutritionStandard.who, ''))
    .key;

/// Immutable country configuration resolved once per session.
/// Every service, provider, and widget receives this via dependency injection.
/// No code outside CountryResolutionChain should ever resolve a CountryProfile.
class CountryProfile {
  const CountryProfile({
    required this.isoCode,
    required this.tier,
    required this.displayName,
    required this.locale,
    required this.currencyCode,
    required this.rtl,
    required this.allergenRegime,
    required this.nutritionStandard,
    required this.callingCode,
    this.mccList = const [],
  });

  /// ISO 3166-1 alpha-2, or 'GLOBAL' for the fallback.
  final String       isoCode;
  final CountryTier  tier;
  final String       displayName;
  /// BCP-47 locale tag for the country's primary language (e.g. 'en_IN').
  final String       locale;
  final String       currencyCode;
  /// True for RTL-primary languages (Arabic, Hebrew, Urdu).
  final bool         rtl;
  final AllergenRegime   allergenRegime;
  final NutritionStandard nutritionStandard;
  /// ITU-T calling code, e.g. '+91'.
  final String       callingCode;
  /// Mobile Country Codes for SIM-based detection.
  final List<String> mccList;

  // ── Well-known profiles (used in tests and as fallbacks) ─────────────────

  static const CountryProfile global = CountryProfile(
    isoCode:          'GLOBAL',
    tier:             CountryTier.fallback,
    displayName:      'Global',
    locale:           'en',
    currencyCode:     'USD',
    rtl:              false,
    allergenRegime:   AllergenRegime.whoGlobal,
    nutritionStandard: NutritionStandard.who,
    callingCode:      '',
  );

  static const CountryProfile india = CountryProfile(
    isoCode:          'IN',
    tier:             CountryTier.tier1,
    displayName:      'India',
    locale:           'en_IN',
    currencyCode:     'INR',
    rtl:              false,
    allergenRegime:   AllergenRegime.fssai8,
    nutritionStandard: NutritionStandard.icmrNin,
    callingCode:      '+91',
    mccList:          ['404', '405'],
  );

  @override
  bool operator ==(Object other) =>
      other is CountryProfile && isoCode == other.isoCode;

  @override
  int get hashCode => isoCode.hashCode;

  @override
  String toString() => 'CountryProfile($isoCode, $tier)';

  /// JSON serialisation — matches `apps/api/src/country/types.ts`'s `CountryProfile` wire
  /// shape exactly (both for the SharedPreferences cache round-trip and for parsing real API
  /// responses, e.g. `GET /v1/onboarding/country`, Phase 10).
  Map<String, dynamic> toJson() => {
    'isoCode':           isoCode,
    'tier':              tier.name,
    'displayName':       displayName,
    'locale':            locale,
    'currencyCode':      currencyCode,
    'rtl':               rtl,
    'allergenRegime':    _allergenRegimeWire[allergenRegime],
    'nutritionStandard': _nutritionStandardWire[nutritionStandard],
    'callingCode':       callingCode,
    'mccList':           mccList,
  };

  factory CountryProfile.fromJson(Map<String, dynamic> j) => CountryProfile(
    isoCode:           j['isoCode']   as String,
    tier:              CountryTier.values.byName(j['tier'] as String),
    displayName:       j['displayName'] as String,
    locale:            j['locale']    as String,
    currencyCode:      j['currencyCode'] as String,
    rtl:               j['rtl']       as bool,
    allergenRegime:    _allergenRegimeFromWire(j['allergenRegime'] as String),
    nutritionStandard: _nutritionStandardFromWire(j['nutritionStandard'] as String),
    callingCode:       j['callingCode'] as String,
    mccList:           List<String>.from(j['mccList'] as List),
  );
}

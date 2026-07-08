// Country Intelligence — core types.
// These are the authoritative type definitions for CountryProfile in TypeScript.
// The Dart counterpart in packages/country_engine must stay in sync.

export type CountryTier = 'tier1' | 'tier2' | 'fallback';

/** Per-country mandatory allergen declaration regime. */
export type AllergenRegime =
  | 'FSSAI_8'       // India — 8 allergens (FSSAI Food Safety Regulations 2023)
  | 'FDA_9_SESAME'  // US — 9 major allergens incl. sesame (FASTER Act 2023)
  | 'EU_14'         // EU, UK, CH, NO — 14 allergens (Reg. 1169/2011)
  | 'JP_8'          // Japan — 8 mandatory + 20 recommended
  | 'WHO_GLOBAL';   // WHO advisory list — used for all other countries

/** Authoritative dietary reference values standard applied for this country. */
export type NutritionStandard =
  | 'ICMR_NIN'   // India — ICMR-NIN 2020
  | 'US_DRI'     // United States / Canada — USDA DRI
  | 'UK_SACN'    // United Kingdom — SACN/COMA values
  | 'EFSA'       // EU + EEA — EFSA Dietary Reference Values
  | 'NHMRC'      // Australia / New Zealand — NHMRC NRVs
  | 'JP_DRI'     // Japan — Dietary Reference Intakes (日本人の食事摂取基準)
  | 'HPB_SG'     // Singapore — Health Promotion Board RNI
  | 'WHO';       // Global / WHO — Nutrient Requirements (all other countries)

/**
 * CountryProfile — the central spine of the Global Enterprise Edition.
 * Resolved ONCE per session; injected everywhere; never hardcoded.
 */
export interface CountryProfile {
  /** ISO 3166-1 alpha-2 code, or 'GLOBAL' for the fallback. */
  isoCode:            string;
  tier:               CountryTier;
  displayName:        string;
  /** BCP-47 locale tag for this country's primary language. */
  locale:             string;
  currencyCode:       string;
  /** True for RTL-primary languages (Arabic, Hebrew, Urdu). */
  rtl:                boolean;
  allergenRegime:     AllergenRegime;
  nutritionStandard:  NutritionStandard;
  /** ITU-T calling code prefix, e.g. '+91'. */
  callingCode:        string;
  /** Mobile Country Codes for SIM-based detection. */
  mccList:            string[];
}

/** The GLOBAL fallback profile — all features available but no country-specific rules. */
export const GLOBAL_PROFILE: CountryProfile = {
  isoCode:           'GLOBAL',
  tier:              'fallback',
  displayName:       'Global',
  locale:            'en',
  currencyCode:      'USD',
  rtl:               false,
  allergenRegime:    'WHO_GLOBAL',
  nutritionStandard: 'WHO',
  callingCode:       '',
  mccList:           [],
};

/** The India default profile — used when country_engine flag is OFF. */
export const INDIA_PROFILE: CountryProfile = {
  isoCode:           'IN',
  tier:              'tier1',
  displayName:       'India',
  locale:            'en_IN',
  currencyCode:      'INR',
  rtl:               false,
  allergenRegime:    'FSSAI_8',
  nutritionStandard: 'ICMR_NIN',
  callingCode:       '+91',
  mccList:           ['404', '405'],
};

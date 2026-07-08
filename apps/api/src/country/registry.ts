// Country registry — 8 Tier-1, 17 Tier-2, and the GLOBAL fallback.
// Adding a new country requires: (1) add entry here, (2) seed nutrition rule pack in Phase 4.
// No code changes required outside this file + rule pack seed for new countries.

import type { CountryProfile } from './types.js';
import { GLOBAL_PROFILE } from './types.js';

// ── Tier 1 (full feature set, native data sources, human-reviewed l10n) ───────

const TIER1: CountryProfile[] = [
  {
    isoCode: 'IN', tier: 'tier1', displayName: 'India',
    locale: 'en_IN', currencyCode: 'INR', rtl: false,
    allergenRegime: 'FSSAI_8', nutritionStandard: 'ICMR_NIN',
    callingCode: '+91', mccList: ['404', '405'],
  },
  {
    isoCode: 'US', tier: 'tier1', displayName: 'United States',
    locale: 'en_US', currencyCode: 'USD', rtl: false,
    allergenRegime: 'FDA_9_SESAME', nutritionStandard: 'US_DRI',
    callingCode: '+1', mccList: ['310', '311', '312', '313', '314', '315', '316'],
  },
  {
    isoCode: 'GB', tier: 'tier1', displayName: 'United Kingdom',
    locale: 'en_GB', currencyCode: 'GBP', rtl: false,
    allergenRegime: 'EU_14', nutritionStandard: 'UK_SACN',
    callingCode: '+44', mccList: ['234', '235'],
  },
  {
    isoCode: 'AE', tier: 'tier1', displayName: 'UAE',
    locale: 'ar_AE', currencyCode: 'AED', rtl: true,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+971', mccList: ['424', '430'],
  },
  {
    isoCode: 'SG', tier: 'tier1', displayName: 'Singapore',
    locale: 'en_SG', currencyCode: 'SGD', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'HPB_SG',
    callingCode: '+65', mccList: ['525'],
  },
  {
    isoCode: 'AU', tier: 'tier1', displayName: 'Australia',
    locale: 'en_AU', currencyCode: 'AUD', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'NHMRC',
    callingCode: '+61', mccList: ['505'],
  },
  {
    isoCode: 'CA', tier: 'tier1', displayName: 'Canada',
    locale: 'en_CA', currencyCode: 'CAD', rtl: false,
    allergenRegime: 'FDA_9_SESAME', nutritionStandard: 'US_DRI',
    callingCode: '+1', mccList: ['302'],
  },
  {
    isoCode: 'DE', tier: 'tier1', displayName: 'Germany',
    locale: 'de_DE', currencyCode: 'EUR', rtl: false,
    allergenRegime: 'EU_14', nutritionStandard: 'EFSA',
    callingCode: '+49', mccList: ['262'],
  },
];

// ── Tier 2 (core features, MT l10n, WHO nutrition standard where applicable) ──

const TIER2: CountryProfile[] = [
  {
    isoCode: 'JP', tier: 'tier2', displayName: 'Japan',
    locale: 'ja_JP', currencyCode: 'JPY', rtl: false,
    allergenRegime: 'JP_8', nutritionStandard: 'JP_DRI',
    callingCode: '+81', mccList: ['440', '441'],
  },
  {
    isoCode: 'FR', tier: 'tier2', displayName: 'France',
    locale: 'fr_FR', currencyCode: 'EUR', rtl: false,
    allergenRegime: 'EU_14', nutritionStandard: 'EFSA',
    callingCode: '+33', mccList: ['208'],
  },
  {
    isoCode: 'KR', tier: 'tier2', displayName: 'South Korea',
    locale: 'ko_KR', currencyCode: 'KRW', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+82', mccList: ['450'],
  },
  {
    isoCode: 'BR', tier: 'tier2', displayName: 'Brazil',
    locale: 'pt_BR', currencyCode: 'BRL', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+55', mccList: ['724'],
  },
  {
    isoCode: 'MX', tier: 'tier2', displayName: 'Mexico',
    locale: 'es_MX', currencyCode: 'MXN', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+52', mccList: ['334'],
  },
  {
    isoCode: 'ID', tier: 'tier2', displayName: 'Indonesia',
    locale: 'id_ID', currencyCode: 'IDR', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+62', mccList: ['510'],
  },
  {
    isoCode: 'TH', tier: 'tier2', displayName: 'Thailand',
    locale: 'th_TH', currencyCode: 'THB', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+66', mccList: ['520'],
  },
  {
    isoCode: 'MY', tier: 'tier2', displayName: 'Malaysia',
    locale: 'ms_MY', currencyCode: 'MYR', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+60', mccList: ['502'],
  },
  {
    isoCode: 'PH', tier: 'tier2', displayName: 'Philippines',
    locale: 'en_PH', currencyCode: 'PHP', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+63', mccList: ['515'],
  },
  {
    isoCode: 'VN', tier: 'tier2', displayName: 'Vietnam',
    locale: 'vi_VN', currencyCode: 'VND', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+84', mccList: ['452'],
  },
  {
    isoCode: 'ZA', tier: 'tier2', displayName: 'South Africa',
    locale: 'en_ZA', currencyCode: 'ZAR', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+27', mccList: ['655'],
  },
  {
    isoCode: 'NG', tier: 'tier2', displayName: 'Nigeria',
    locale: 'en_NG', currencyCode: 'NGN', rtl: false,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+234', mccList: ['621'],
  },
  {
    isoCode: 'EG', tier: 'tier2', displayName: 'Egypt',
    locale: 'ar_EG', currencyCode: 'EGP', rtl: true,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+20', mccList: ['602'],
  },
  {
    isoCode: 'SA', tier: 'tier2', displayName: 'Saudi Arabia',
    locale: 'ar_SA', currencyCode: 'SAR', rtl: true,
    allergenRegime: 'WHO_GLOBAL', nutritionStandard: 'WHO',
    callingCode: '+966', mccList: ['420'],
  },
  {
    isoCode: 'IT', tier: 'tier2', displayName: 'Italy',
    locale: 'it_IT', currencyCode: 'EUR', rtl: false,
    allergenRegime: 'EU_14', nutritionStandard: 'EFSA',
    callingCode: '+39', mccList: ['222'],
  },
  {
    isoCode: 'ES', tier: 'tier2', displayName: 'Spain',
    locale: 'es_ES', currencyCode: 'EUR', rtl: false,
    allergenRegime: 'EU_14', nutritionStandard: 'EFSA',
    callingCode: '+34', mccList: ['214'],
  },
  {
    isoCode: 'NL', tier: 'tier2', displayName: 'Netherlands',
    locale: 'nl_NL', currencyCode: 'EUR', rtl: false,
    allergenRegime: 'EU_14', nutritionStandard: 'EFSA',
    callingCode: '+31', mccList: ['204'],
  },
];

// ── Registry build ─────────────────────────────────────────────────────────────

const ALL_PROFILES = [...TIER1, ...TIER2];

/** Keyed by ISO 3166-1 alpha-2 upper-case code. */
export const COUNTRY_REGISTRY = new Map<string, CountryProfile>(
  ALL_PROFILES.map((p) => [p.isoCode, p]),
);

/** Reverse-lookup: MCC string → CountryProfile. */
const MCC_INDEX = new Map<string, CountryProfile>();
for (const profile of ALL_PROFILES) {
  for (const mcc of profile.mccList) {
    MCC_INDEX.set(mcc, profile);
  }
}

/** Look up a profile by ISO code. Returns undefined for unknown countries. */
export function lookupCountry(isoCode: string): CountryProfile | undefined {
  return COUNTRY_REGISTRY.get(isoCode.toUpperCase());
}

/** Look up a profile by ISO code or fall back to GLOBAL. */
export function lookupCountryOrGlobal(isoCode: string): CountryProfile {
  return lookupCountry(isoCode) ?? GLOBAL_PROFILE;
}

/** Look up a profile by MCC string. Returns undefined for unknown MCCs. */
export function lookupByMcc(mcc: string): CountryProfile | undefined {
  return MCC_INDEX.get(mcc);
}

/**
 * Extract ISO-3166 region code from a BCP-47 locale string.
 * E.g. 'en-US' → 'US', 'zh-Hans-CN' → 'CN', 'de' → null.
 */
export function regionFromLocale(locale: string): string | null {
  const parts = locale.split(/[-_]/);
  // BCP-47: lang[-script][-region]. Region is 2 uppercase alpha chars.
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i]!;
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return null;
}

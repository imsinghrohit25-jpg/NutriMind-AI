// Country engine — resolution chain + registry tests.

import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';

void main() {
  group('CountryRegistry', () {
    test('all 8 Tier-1 countries resolve', () {
      for (final code in ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA', 'DE']) {
        final p = CountryRegistry.lookup(code);
        expect(p, isNotNull, reason: '$code not found');
        expect(p!.tier, CountryTier.tier1);
      }
    });

    test('all 17 Tier-2 countries resolve', () {
      for (final code in [
        'JP','FR','KR','BR','MX','ID','TH','MY','PH','VN','ZA','NG','EG','SA','IT','ES','NL'
      ]) {
        final p = CountryRegistry.lookup(code);
        expect(p, isNotNull, reason: '$code not found');
        expect(p!.tier, CountryTier.tier2);
      }
    });

    test('case-insensitive lookup', () {
      expect(CountryRegistry.lookup('in')?.isoCode, 'IN');
      expect(CountryRegistry.lookup('us')?.isoCode, 'US');
    });

    test('unknown country returns null', () {
      expect(CountryRegistry.lookup('ZZ'), isNull);
    });

    test('lookupOrGlobal returns GLOBAL for unknown', () {
      final p = CountryRegistry.lookupOrGlobal('ZZ');
      expect(p.isoCode, 'GLOBAL');
      expect(p.tier, CountryTier.fallback);
    });

    test('MCC lookup works for Tier-1 countries', () {
      expect(CountryRegistry.lookupByMcc('404')?.isoCode, 'IN');
      expect(CountryRegistry.lookupByMcc('405')?.isoCode, 'IN');
      expect(CountryRegistry.lookupByMcc('310')?.isoCode, 'US');
      expect(CountryRegistry.lookupByMcc('234')?.isoCode, 'GB');
      expect(CountryRegistry.lookupByMcc('525')?.isoCode, 'SG');
    });

    test('unknown MCC returns null', () {
      expect(CountryRegistry.lookupByMcc('999'), isNull);
    });

    test('all profiles have non-empty locale and callingCode', () {
      for (final p in CountryRegistry.all) {
        expect(p.locale, isNotEmpty, reason: '${p.isoCode} locale empty');
        expect(p.callingCode, isNotEmpty, reason: '${p.isoCode} callingCode empty');
      }
    });
  });

  group('CountryProfile fields', () {
    test('India allergen regime is FSSAI_8', () {
      expect(CountryProfile.india.allergenRegime, AllergenRegime.fssai8);
    });

    test('India nutrition standard is ICMR-NIN', () {
      expect(CountryProfile.india.nutritionStandard, NutritionStandard.icmrNin);
    });

    test('US allergen regime is FDA_9_SESAME', () {
      final us = CountryRegistry.lookup('US')!;
      expect(us.allergenRegime, AllergenRegime.fda9Sesame);
    });

    test('EU countries allergen regime is EU_14', () {
      for (final code in ['GB', 'DE', 'FR', 'IT', 'ES', 'NL']) {
        expect(CountryRegistry.lookup(code)!.allergenRegime, AllergenRegime.eu14,
            reason: '$code should be EU_14');
      }
    });

    test('Japan allergen regime is JP_8', () {
      expect(CountryRegistry.lookup('JP')!.allergenRegime, AllergenRegime.jp8);
    });

    test('RTL is true for AE, EG, SA', () {
      for (final code in ['AE', 'EG', 'SA']) {
        expect(CountryRegistry.lookup(code)!.rtl, isTrue, reason: '$code should be RTL');
      }
    });

    test('RTL is false for IN, US, GB, JP', () {
      for (final code in ['IN', 'US', 'GB', 'JP']) {
        expect(CountryRegistry.lookup(code)!.rtl, isFalse, reason: '$code should not be RTL');
      }
    });

    test('JSON round-trip preserves all fields', () {
      final original = CountryProfile.india;
      final decoded  = CountryProfile.fromJson(original.toJson());
      expect(decoded.isoCode,          original.isoCode);
      expect(decoded.tier,             original.tier);
      expect(decoded.allergenRegime,   original.allergenRegime);
      expect(decoded.nutritionStandard, original.nutritionStandard);
      expect(decoded.rtl,              original.rtl);
      expect(decoded.mccList,          original.mccList);
    });

    test('toJson emits the real server wire-format strings, not Dart enum member names', () {
      // Phase 10 regression: fromJson()/toJson() used to round-trip via `.name`/`byName()`,
      // which only ever matched Dart's own enum member names ('fssai8', 'icmrNin') — never the
      // real values apps/api/src/country/types.ts actually sends ('FSSAI_8', 'ICMR_NIN'). This
      // was undetected because the only prior caller was a self-consistent SharedPreferences
      // round-trip (Dart writing then reading its own output), never real API JSON.
      final json = CountryProfile.india.toJson();
      expect(json['allergenRegime'], 'FSSAI_8');
      expect(json['nutritionStandard'], 'ICMR_NIN');
    });

    test('fromJson parses the real server wire-format strings correctly', () {
      final json = {
        'isoCode': 'GB', 'tier': 'tier1', 'displayName': 'United Kingdom',
        'locale': 'en_GB', 'currencyCode': 'GBP', 'rtl': false,
        'allergenRegime': 'EU_14', 'nutritionStandard': 'UK_SACN',
        'callingCode': '+44', 'mccList': ['234', '235'],
      };
      final profile = CountryProfile.fromJson(json);
      expect(profile.allergenRegime, AllergenRegime.eu14);
      expect(profile.nutritionStandard, NutritionStandard.ukSacn);
    });
  });

  group('CountryResolutionChain', () {
    const chain = CountryResolutionChain();

    test('Step 1: stored override wins', () async {
      final r = await chain.resolve(storedOverride: 'US');
      expect(r.profile.isoCode, 'US');
      expect(r.resolvedBy, 'stored-override');
    });

    test('Step 2: API profile wins when no override', () async {
      final r = await chain.resolve(apiProfileCountry: 'GB');
      expect(r.profile.isoCode, 'GB');
      expect(r.resolvedBy, 'api-profile');
    });

    test('Step 1 wins over Step 2', () async {
      final r = await chain.resolve(storedOverride: 'CA', apiProfileCountry: 'AU');
      expect(r.profile.isoCode, 'CA');
    });

    test('Step 4: OS locale region', () async {
      final r = await chain.resolve(osLocale: 'de_DE');
      expect(r.profile.isoCode, 'DE');
      expect(r.resolvedBy, 'os-locale');
    });

    test('Step 5: stored last-known fallback', () async {
      final r = await chain.resolve(storedLastKnown: 'SG');
      expect(r.profile.isoCode, 'SG');
      expect(r.resolvedBy, 'stored-last-known');
    });

    test('Step 6: GLOBAL when all steps fail', () async {
      final r = await chain.resolve(
        storedOverride: null,
        apiProfileCountry: null,
        osLocale: 'zh',  // no region subtag
        storedLastKnown: null,
      );
      expect(r.profile.isoCode, 'GLOBAL');
      expect(r.resolvedBy, 'fallback');
    });

    test('unknown override falls through to next step', () async {
      final r = await chain.resolve(storedOverride: 'ZZ', storedLastKnown: 'AU');
      expect(r.profile.isoCode, 'AU');
    });

    test('locale with unknown region falls through', () async {
      final r = await chain.resolve(osLocale: 'en_ZZ', storedLastKnown: 'NZ');
      // NZ is not in registry → GLOBAL
      expect(r.resolvedBy, 'fallback');
    });
  });

  group('regionFromLocale', () {
    test('extracts region from BCP-47 dash form', () {
      expect(regionFromLocale('en-US'), 'US');
      expect(regionFromLocale('en-IN'), 'IN');
      expect(regionFromLocale('ar-AE'), 'AE');
    });

    test('extracts region from underscore form', () {
      expect(regionFromLocale('en_GB'), 'GB');
      expect(regionFromLocale('de_DE'), 'DE');
    });

    test('returns null for bare language code', () {
      expect(regionFromLocale('en'), isNull);
      expect(regionFromLocale('hi'), isNull);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';
import 'package:nutrimind_nutrition_rules/nutrimind_nutrition_rules.dart';

void main() {
  group('NutritionStandardInfo', () {
    test('every NutritionStandard enum value has registered metadata', () {
      for (final standard in NutritionStandard.values) {
        final info = infoFor(standard);
        expect(info.standard, standard);
        expect(info.displayName, isNotEmpty);
        expect(info.authority, isNotEmpty);
        expect(info.version, isNotEmpty);
      }
    });

    test('standardInfoFor resolves India profile to ICMR-NIN', () {
      final info = standardInfoFor(CountryProfile.india);
      expect(info.standard, NutritionStandard.icmrNin);
      expect(info.authority, contains('FSSAI'));
    });

    test('standardInfoFor resolves GLOBAL profile to WHO', () {
      final info = standardInfoFor(CountryProfile.global);
      expect(info.standard, NutritionStandard.who);
      expect(info.authority, 'World Health Organization');
    });

    test('GB profile resolves to UK SACN', () {
      final gb = CountryRegistry.lookup('GB')!;
      final info = standardInfoFor(gb);
      expect(info.standard, NutritionStandard.ukSacn);
    });

    test('US and Canada both resolve to US DRI', () {
      final us = CountryRegistry.lookup('US')!;
      final ca = CountryRegistry.lookup('CA')!;
      expect(standardInfoFor(us).standard, NutritionStandard.usDri);
      expect(standardInfoFor(ca).standard, NutritionStandard.usDri);
    });
  });
}

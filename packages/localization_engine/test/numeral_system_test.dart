import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_localization_engine/nutrimind_localization_engine.dart';

void main() {
  group('convertNumerals', () {
    test('western passthrough', () {
      expect(convertNumerals('123', NumeralSystem.western), '123');
    });

    test('Arabic-Indic digits 0-9', () {
      expect(convertNumerals('0', NumeralSystem.arabicIndic), '٠');
      expect(convertNumerals('9', NumeralSystem.arabicIndic), '٩');
      expect(convertNumerals('42.5', NumeralSystem.arabicIndic), '٤٢.٥');
    });

    test('Devanagari digits', () {
      expect(convertNumerals('0', NumeralSystem.devanagari), '०');
      expect(convertNumerals('9', NumeralSystem.devanagari), '९');
      expect(convertNumerals('100', NumeralSystem.devanagari), '१००');
    });

    test('Bengali digits', () {
      expect(convertNumerals('0', NumeralSystem.bengali), '০');
      expect(convertNumerals('9', NumeralSystem.bengali), '৯');
      expect(convertNumerals('3.14', NumeralSystem.bengali), '৩.১৪');
    });

    test('Gujarati digits', () {
      expect(convertNumerals('0', NumeralSystem.gujarati), '૦');
      expect(convertNumerals('9', NumeralSystem.gujarati), '૯');
    });

    test('Gurmukhi digits', () {
      expect(convertNumerals('0', NumeralSystem.gurmukhi), '੦');
      expect(convertNumerals('9', NumeralSystem.gurmukhi), '੯');
    });

    test('non-digit characters preserved', () {
      expect(convertNumerals('3.5g', NumeralSystem.devanagari), '३.५g');
      expect(convertNumerals('-12', NumeralSystem.arabicIndic), '-١٢');
    });
  });

  group('formatInt', () {
    test('western', () => expect(formatInt(100, NumeralSystem.western), '100'));
    test('devanagari', () => expect(formatInt(4, NumeralSystem.devanagari), '४'));
  });

  group('formatDouble', () {
    test('western default 1dp', () =>
        expect(formatDouble(3.14, NumeralSystem.western), '3.1'));
    test('devanagari 2dp', () =>
        expect(formatDouble(2.7, NumeralSystem.devanagari, fractionDigits: 2), '२.७०'));
    test('arabic-indic', () =>
        expect(formatDouble(9.5, NumeralSystem.arabicIndic), '٩.٥'));
  });

  group('resolveNumeralSystem', () {
    test('flag OFF always returns western', () {
      expect(resolveNumeralSystem('ar', enabled: false), NumeralSystem.western);
      expect(resolveNumeralSystem('hi', enabled: false), NumeralSystem.western);
    });

    test('flag ON returns locale-specific', () {
      expect(resolveNumeralSystem('ar', enabled: true), NumeralSystem.arabicIndic);
      expect(resolveNumeralSystem('ur', enabled: true), NumeralSystem.arabicIndic);
      expect(resolveNumeralSystem('hi', enabled: true), NumeralSystem.devanagari);
      expect(resolveNumeralSystem('mr', enabled: true), NumeralSystem.devanagari);
      expect(resolveNumeralSystem('bn', enabled: true), NumeralSystem.bengali);
      expect(resolveNumeralSystem('gu', enabled: true), NumeralSystem.gujarati);
      expect(resolveNumeralSystem('pa', enabled: true), NumeralSystem.gurmukhi);
    });

    test('flag ON, Latin-script locales return western', () {
      expect(resolveNumeralSystem('en', enabled: true), NumeralSystem.western);
      expect(resolveNumeralSystem('es', enabled: true), NumeralSystem.western);
      expect(resolveNumeralSystem('ta', enabled: true), NumeralSystem.western);
    });

    test('case insensitive', () {
      expect(resolveNumeralSystem('AR', enabled: true), NumeralSystem.arabicIndic);
      expect(resolveNumeralSystem('HI', enabled: true), NumeralSystem.devanagari);
    });
  });
}

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_localization_engine/nutrimind_localization_engine.dart';

void main() {
  group('textDirectionFor', () {
    test('LTR by default for English', () {
      expect(textDirectionFor(languageCode: 'en'), TextDirection.ltr);
    });

    test('RTL for Arabic language tag', () {
      expect(textDirectionFor(languageCode: 'ar'), TextDirection.rtl);
    });

    test('RTL for Hebrew', () {
      expect(textDirectionFor(languageCode: 'he'), TextDirection.rtl);
    });

    test('RTL for Urdu', () {
      expect(textDirectionFor(languageCode: 'ur'), TextDirection.rtl);
    });

    test('profileRtl=true overrides language tag', () {
      expect(
        textDirectionFor(languageCode: 'en', profileRtl: true),
        TextDirection.rtl,
      );
    });

    test('profileRtl=false does not override RTL language tag', () {
      expect(
        textDirectionFor(languageCode: 'ar', profileRtl: false),
        TextDirection.rtl,
      );
    });

    test('Indian LTR languages are LTR', () {
      for (final lang in ['hi', 'mr', 'ta', 'te', 'bn', 'gu', 'pa', 'kn', 'ml']) {
        expect(
          textDirectionFor(languageCode: lang),
          TextDirection.ltr,
          reason: '$lang should be LTR',
        );
      }
    });
  });

  group('isRtlLocale', () {
    test('ar-AE is RTL', () => expect(isRtlLocale('ar-AE'), isTrue));
    test('ar is RTL', () => expect(isRtlLocale('ar'), isTrue));
    test('he-IL is RTL', () => expect(isRtlLocale('he-IL'), isTrue));
    test('ur-PK is RTL', () => expect(isRtlLocale('ur-PK'), isTrue));
    test('en-US is LTR', () => expect(isRtlLocale('en-US'), isFalse));
    test('hi-IN is LTR', () => expect(isRtlLocale('hi-IN'), isFalse));
  });
}

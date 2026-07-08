import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';
import 'package:nutrimind_voice_engine/nutrimind_voice_engine.dart';

void main() {
  group('sttStrategyFor', () {
    test('routes tier1 to on-device STT', () {
      expect(sttStrategyFor(CountryTier.tier1), SttStrategy.onDevice);
    });

    test('routes tier2 to cloud STT', () {
      expect(sttStrategyFor(CountryTier.tier2), SttStrategy.cloud);
    });

    test('routes fallback to cloud STT', () {
      expect(sttStrategyFor(CountryTier.fallback), SttStrategy.cloud);
    });
  });

  group('wakeWordAvailabilityFor', () {
    test('is unavailable for en — no bundled keyword model exists yet', () {
      final result = wakeWordAvailabilityFor('en');
      expect(result.available, false);
      expect(result.reason, isNotNull);
    });

    test('is unavailable for hi and mr', () {
      expect(wakeWordAvailabilityFor('hi').available, false);
      expect(wakeWordAvailabilityFor('mr').available, false);
    });
  });
}

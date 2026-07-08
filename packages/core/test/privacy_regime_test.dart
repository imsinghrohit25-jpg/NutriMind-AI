import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_core/nutrimind_core.dart';

void main() {
  group('privacyRegimeFor', () {
    test('resolves dpdp for India', () {
      expect(privacyRegimeFor('IN'), PrivacyRegime.dpdp);
    });

    test('is case-insensitive', () {
      expect(privacyRegimeFor('in'), PrivacyRegime.dpdp);
    });

    test('resolves gdpr for EU/UK countries', () {
      for (final iso in ['GB', 'DE', 'FR', 'IT', 'ES', 'NL']) {
        expect(privacyRegimeFor(iso), PrivacyRegime.gdpr);
      }
    });

    test('defaults to generic for every other country', () {
      for (final iso in ['US', 'AE', 'SG', 'AU', 'JP', 'GLOBAL']) {
        expect(privacyRegimeFor(iso), PrivacyRegime.generic);
      }
    });
  });

  group('consentRequirementsFor', () {
    test('gdpr requires explicit, granular healthData consent', () {
      final reqs = consentRequirementsFor(PrivacyRegime.gdpr);
      final healthData = reqs.firstWhere((r) => r.consentType == ConsentType.healthData);
      expect(healthData.mandatory, true);
      expect(healthData.granular, true);
    });

    test('generic baseline treats healthData as optional opt-in', () {
      final reqs = consentRequirementsFor(PrivacyRegime.generic);
      final healthData = reqs.firstWhere((r) => r.consentType == ConsentType.healthData);
      expect(healthData.mandatory, false);
    });

    test('marketing is never mandatory in any regime', () {
      for (final regime in PrivacyRegime.values) {
        final marketing = consentRequirementsFor(regime).firstWhere((r) => r.consentType == ConsentType.marketing);
        expect(marketing.mandatory, false);
      }
    });

    test('every regime covers every consent type exactly once', () {
      for (final regime in PrivacyRegime.values) {
        final types = consentRequirementsFor(regime).map((r) => r.consentType).toSet();
        expect(types.length, ConsentType.values.length);
      }
    });
  });

  group('consentTypeToApi', () {
    test('maps healthData to health_data (server snake_case)', () {
      expect(consentTypeToApi(ConsentType.healthData), 'health_data');
    });

    test('other types map to their own name', () {
      expect(consentTypeToApi(ConsentType.marketing), 'marketing');
      expect(consentTypeToApi(ConsentType.tos), 'tos');
    });

    test('maps aiPersonalization to ai_personalization, not the bare camelCase .name', () {
      // Regression test for the exact bug class found in country_profile.dart (ADR-0024): a
      // `.name` fallback silently emits 'aiPersonalization' instead of the server's real
      // snake_case wire string.
      expect(consentTypeToApi(ConsentType.aiPersonalization), 'ai_personalization');
      expect(consentTypeToApi(ConsentType.aiPersonalization), isNot('aiPersonalization'));
    });
  });

  group('AI Memory System consent (Phase 11)', () {
    test('aiPersonalization is never mandatory in any regime — opt-in only', () {
      for (final regime in PrivacyRegime.values) {
        final req = consentRequirementsFor(regime).firstWhere((r) => r.consentType == ConsentType.aiPersonalization);
        expect(req.mandatory, false);
        expect(req.granular, true);
      }
    });
  });
}

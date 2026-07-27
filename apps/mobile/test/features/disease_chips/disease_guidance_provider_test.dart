import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/features/disease_chips/disease_guidance_provider.dart';

void main() {
  group('DiseaseGuidance.fromBody', () {
    test('parses the wrapped { data: { conditions, guidance } } envelope', () {
      final g = DiseaseGuidance.fromBody({
        'ok': true,
        'data': {
          'conditions': ['diabetes', 'hypertension'],
          'guidance': [
            {'condition': 'diabetes', 'label': 'Diabetes', 'avoidFoods': ['Sugar', 'Maida']},
            {'condition': 'hypertension', 'label': 'Hypertension', 'avoidFoods': ['Pickles']},
          ],
        },
        'meta': {'version': 'v1'},
      });
      expect(g.isEmpty, isFalse);
      expect(g.conditions, ['diabetes', 'hypertension']);
      expect(g.blocks, hasLength(2));
      expect(g.blocks.first['label'], 'Diabetes');
      expect((g.blocks.first['avoidFoods'] as List).first, 'Sugar');
    });

    test('tolerates an already-unwrapped body', () {
      final g = DiseaseGuidance.fromBody({
        'conditions': ['thyroid'],
        'guidance': [
          {'condition': 'thyroid', 'label': 'Thyroid'},
        ],
      });
      expect(g.conditions, ['thyroid']);
      expect(g.blocks, hasLength(1));
    });

    test('empty when the user has no conditions', () {
      final g = DiseaseGuidance.fromBody({'data': {'conditions': <String>[], 'guidance': <dynamic>[]}});
      expect(g.isEmpty, isTrue);
      expect(g.conditions, isEmpty);
    });

    test('empty on a malformed / missing body (never throws)', () {
      expect(DiseaseGuidance.fromBody(const {}).isEmpty, isTrue);
      expect(DiseaseGuidance.fromBody({'data': 'not-a-map'}).isEmpty, isTrue);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/features/history_search/history_search_provider.dart';

void main() {
  group('parseHistoryResults', () {
    test('extracts the results list from the wrapped envelope', () {
      final r = parseHistoryResults({
        'data': {
          'query': 'high sodium snacks',
          'results': [
            {'productName': 'Salty chips', 'healthScore': 32, 'band': 'poor', 'similarity': 0.88, 'category': 'snacks'},
            {'productName': 'Namkeen', 'healthScore': 40, 'band': 'fair', 'similarity': 0.81},
          ],
        },
      });
      expect(r, hasLength(2));
      expect(r[0]['productName'], 'Salty chips');
      expect(r[1]['band'], 'fair');
    });

    test('empty / malformed → empty list (never throws)', () {
      expect(parseHistoryResults({'data': {'results': <dynamic>[]}}), isEmpty);
      expect(parseHistoryResults(const {}), isEmpty);
      expect(parseHistoryResults({'data': 'nope'}), isEmpty);
      expect(parseHistoryResults({'results': [{'productName': 'X'}]}), hasLength(1)); // unwrapped
    });
  });
}

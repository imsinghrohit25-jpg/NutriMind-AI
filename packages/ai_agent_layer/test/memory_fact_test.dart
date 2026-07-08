import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_ai_agent_layer/nutrimind_ai_agent_layer.dart';

void main() {
  group('MemoryFact.fromJson', () {
    test('parses a real server response shape', () {
      final json = {
        'factId': 'f1',
        'factType': 'eating_pattern',
        'factKey': 'meal_timing_breakfast',
        'value': {'avgHourUtc': 8},
        'confidence': 0.8,
        'computedAt': '2026-01-01T00:00:00.000Z',
        'validUntil': '2026-03-01T00:00:00.000Z',
      };
      final fact = MemoryFact.fromJson(json);
      expect(fact.factId, 'f1');
      expect(fact.value['avgHourUtc'], 8);
      expect(fact.computedAt, DateTime.parse('2026-01-01T00:00:00.000Z'));
    });

    test('sectionLabel maps known fact types to a human-readable label', () {
      final fact = MemoryFact.fromJson({
        'factId': 'f1', 'factType': 'health_goal', 'factKey': 'active_goal',
        'value': {}, 'confidence': 1,
        'computedAt': '2026-01-01T00:00:00.000Z', 'validUntil': '2026-03-01T00:00:00.000Z',
      });
      expect(fact.sectionLabel, 'Health goals');
    });

    test('sectionLabel falls back to the raw factType for unknown types', () {
      final fact = MemoryFact.fromJson({
        'factId': 'f1', 'factType': 'some_future_type', 'factKey': 'x',
        'value': {}, 'confidence': 1,
        'computedAt': '2026-01-01T00:00:00.000Z', 'validUntil': '2026-03-01T00:00:00.000Z',
      });
      expect(fact.sectionLabel, 'some_future_type');
    });
  });
}

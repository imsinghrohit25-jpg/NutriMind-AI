import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/core/network/sse_event.dart';

void main() {
  group('SseEvent.parse', () {
    test('parses a real event/data frame pair', () {
      final event = SseEvent.parse('event: agent_started\ndata: {"plan":["nutrition"]}');
      expect(event, isNotNull);
      expect(event!.type, 'agent_started');
      expect(event.data, {'plan': ['nutrition']});
    });

    test('returns null for a frame with no event: line', () {
      expect(SseEvent.parse('data: {"foo":1}'), isNull);
    });

    test('passes through a non-JSON data payload as a raw string rather than dropping it', () {
      final event = SseEvent.parse('event: done\ndata: not json');
      expect(event!.data, 'not json');
    });

    test('handles an event with no data line at all', () {
      final event = SseEvent.parse('event: done');
      expect(event!.type, 'done');
      expect(event.data, isNull);
    });
  });
}

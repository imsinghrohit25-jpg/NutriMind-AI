import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_ai_agent_layer/nutrimind_ai_agent_layer.dart';
import 'package:nutrimind/features/memory/screens/memory_screen.dart';

MemoryFact _fact({String factId = 'f1', String factType = 'eating_pattern', String factKey = 'meal_timing_breakfast'}) {
  return MemoryFact(
    factId: factId,
    factType: factType,
    factKey: factKey,
    value: const {'avgHourUtc': 8},
    confidence: 0.8,
    computedAt: DateTime.parse('2026-01-01T00:00:00Z'),
    validUntil: DateTime.parse('2026-03-01T00:00:00Z'),
  );
}

void main() {
  group('MemoryTransparencyView', () {
    testWidgets('shows an empty state when there are no facts yet', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MemoryTransparencyView(facts: const [], onDelete: (_) async {}),
      ));
      expect(find.textContaining('hasn’t learned anything'), findsOneWidget);
    });

    testWidgets('shows an error state distinctly from the empty state', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MemoryTransparencyView(facts: const [], error: 'boom', onDelete: (_) async {}),
      ));
      expect(find.textContaining('Couldn’t load'), findsOneWidget);
      expect(find.textContaining('hasn’t learned anything'), findsNothing);
    });

    testWidgets('groups facts by their section label', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: MemoryTransparencyView(
            facts: [_fact(factId: 'f1', factType: 'eating_pattern'), _fact(factId: 'f2', factType: 'health_goal', factKey: 'active_goal')],
            onDelete: (_) async {},
          ),
        ),
      ));
      expect(find.text('Eating patterns'), findsOneWidget);
      expect(find.text('Health goals'), findsOneWidget);
    });

    testWidgets('tapping delete calls onDelete with the right fact', (tester) async {
      MemoryFact? deleted;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: MemoryTransparencyView(
            facts: [_fact()],
            onDelete: (fact) async { deleted = fact; },
          ),
        ),
      ));
      await tester.tap(find.byIcon(Icons.delete_outline));
      await tester.pump();
      expect(deleted?.factId, 'f1');
    });

    testWidgets('swipe-to-dismiss also calls onDelete', (tester) async {
      MemoryFact? deleted;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: MemoryTransparencyView(
            facts: [_fact()],
            onDelete: (fact) async { deleted = fact; },
          ),
        ),
      ));
      await tester.drag(find.byType(Dismissible), const Offset(-500, 0));
      await tester.pumpAndSettle();
      expect(deleted?.factId, 'f1');
    });
  });
}

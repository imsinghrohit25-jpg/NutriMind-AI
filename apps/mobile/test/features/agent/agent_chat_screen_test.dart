// Widget tests for the Phase 13 (`global.p13.multi_agent_system`) presentational component.
// Self-contained — AgentChatView receives its turns via constructor params, so these don't need
// a live ApiClient/SSE connection (same rationale as country_selection_screen_test.dart).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/features/agent/agent_chat_models.dart';
import 'package:nutrimind/features/agent/agent_chat_screen.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('AgentChatView', () {
    testWidgets('shows the empty state with no turns', (tester) async {
      await tester.pumpWidget(_wrap(AgentChatView(
        turns: const [],
        controller: TextEditingController(),
        busy: false,
        onSend: () {},
        onToggleOcrField: (_, __) {},
        onConfirmFoodLog: (_) {},
      )));
      expect(find.text('NutriMind Assistant'), findsOneWidget);
    });

    testWidgets('shows live progress lines while a turn is pending', (tester) async {
      final turn = AgentTurn('what should I eat for dinner')
        ..progressLines.add('Routing to: Nutrition Agent')
        ..progressLines.add('Nutrition Agent is checking nutrition.compute…');

      await tester.pumpWidget(_wrap(AgentChatView(
        turns: [turn],
        controller: TextEditingController(),
        busy: true,
        onSend: () {},
        onToggleOcrField: (_, __) {},
        onConfirmFoodLog: (_) {},
      )));

      expect(find.textContaining('Routing to: Nutrition Agent'), findsOneWidget);
      expect(find.textContaining('checking nutrition.compute'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsWidgets);
    });

    testWidgets('shows the guard rejection reason distinctly, not the raw blocked text', (tester) async {
      final turn = AgentTurn('is this safe for my allergy')..errorMessage = 'Allergen re-check blocked this response for: Asha.';

      await tester.pumpWidget(_wrap(AgentChatView(
        turns: [turn],
        controller: TextEditingController(),
        busy: false,
        onSend: () {},
        onToggleOcrField: (_, __) {},
        onConfirmFoodLog: (_) {},
      )));

      expect(find.textContaining('Allergen re-check blocked'), findsOneWidget);
    });

    testWidgets('shows the validated final answer once done', (tester) async {
      final turn = AgentTurn('parle g')..finalText = 'Parle-G: 450kcal per 100g.';

      await tester.pumpWidget(_wrap(AgentChatView(
        turns: [turn],
        controller: TextEditingController(),
        busy: false,
        onSend: () {},
        onToggleOcrField: (_, __) {},
        onConfirmFoodLog: (_) {},
      )));

      expect(find.text('Parle-G: 450kcal per 100g.'), findsOneWidget);
    });

    testWidgets('renders OCR low-confidence fields as tappable confirmation chips', (tester) async {
      final turn = AgentTurn('scan this receipt')
        ..finalText = 'Found 2 items.'
        ..lastHandoffState = {'lastOcrLowConfidenceFields': ['Tomato.quantity']};

      String? toggledField;
      await tester.pumpWidget(_wrap(AgentChatView(
        turns: [turn],
        controller: TextEditingController(),
        busy: false,
        onSend: () {},
        onToggleOcrField: (_, field) => toggledField = field,
        onConfirmFoodLog: (_) {},
      )));

      expect(find.text('Tomato.quantity'), findsOneWidget);
      await tester.tap(find.text('Tomato.quantity'));
      expect(toggledField, 'Tomato.quantity');
    });

    testWidgets('renders a pending food log confirmation card with real parsed foods', (tester) async {
      final turn = AgentTurn('do roti khaya')
        ..finalText = 'Did you have 2piece roti? Say yes to confirm.'
        ..lastHandoffState = {
          'pendingFoodLog': {
            'foods': [
              {'name': 'roti', 'nameRaw': 'do roti', 'quantity': 2, 'unit': 'piece'},
            ],
          },
        };

      AgentTurn? confirmedTurn;
      await tester.pumpWidget(_wrap(AgentChatView(
        turns: [turn],
        controller: TextEditingController(),
        busy: false,
        onSend: () {},
        onToggleOcrField: (_, __) {},
        onConfirmFoodLog: (t) => confirmedTurn = t,
      )));

      expect(find.textContaining('roti'), findsWidgets);
      await tester.tap(find.text('Confirm'));
      expect(confirmedTurn, turn);
    });

    testWidgets('disables the input while a turn is busy', (tester) async {
      await tester.pumpWidget(_wrap(AgentChatView(
        turns: [AgentTurn('hi')],
        controller: TextEditingController(),
        busy: true,
        onSend: () {},
        onToggleOcrField: (_, __) {},
        onConfirmFoodLog: (_) {},
      )));

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.enabled, isFalse);
      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(find.byIcon(Icons.send), findsNothing);
    });
  });
}

// Widget tests for DeferredRoute (Phase 9, `global.p9.deferred_components`). Self-contained —
// does not depend on app.dart/generated l10n (which currently fail `flutter analyze` for
// unrelated, pre-existing reasons — see ADR-0023), so this can run and verify the deferred-
// loading state machine in isolation.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/core/design_system/components/app_loader.dart';
import 'package:nutrimind/core/router/deferred_route.dart';

void main() {
  testWidgets('shows a loading indicator while loadLibrary() is pending', (tester) async {
    final completer = Future<void>.delayed(const Duration(milliseconds: 50));
    await tester.pumpWidget(MaterialApp(
      home: DeferredRoute(
        loadLibrary: () => completer,
        builder: (_) => const Text('Loaded Screen'),
      ),
    ));

    expect(find.byType(AppLoader), findsOneWidget);
    expect(find.text('Loaded Screen'), findsNothing);

    // Let the pending timer finish so it doesn't leak into the next test.
    await tester.pump(const Duration(milliseconds: 60));
  });

  testWidgets('builds the real screen once loadLibrary() resolves', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: DeferredRoute(
        loadLibrary: () => Future<void>.value(),
        builder: (_) => const Text('Loaded Screen'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Loaded Screen'), findsOneWidget);
    expect(find.byType(AppLoader), findsNothing);
  });

  testWidgets('shows an error message when loadLibrary() fails, not a blank/crashed screen', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: DeferredRoute(
        loadLibrary: () => Future<void>.error(Exception('network error')),
        builder: (_) => const Text('Loaded Screen'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('Failed to load feature'), findsOneWidget);
    expect(find.text('Loaded Screen'), findsNothing);
  });

  testWidgets('only calls loadLibrary() once across rebuilds', (tester) async {
    var callCount = 0;
    await tester.pumpWidget(MaterialApp(
      home: DeferredRoute(
        loadLibrary: () {
          callCount++;
          return Future<void>.value();
        },
        builder: (_) => const Text('Loaded Screen'),
      ),
    ));
    await tester.pumpAndSettle();
    // Trigger a rebuild of the same widget tree.
    await tester.pumpWidget(MaterialApp(
      home: DeferredRoute(
        loadLibrary: () {
          callCount++;
          return Future<void>.value();
        },
        builder: (_) => const Text('Loaded Screen'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(callCount, 1); // the `late final` future is captured once in State, not rebuilt
  });
}

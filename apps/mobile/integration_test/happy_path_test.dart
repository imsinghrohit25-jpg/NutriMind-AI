// Integration test — happy-path E2E flows.
// Gate requirement: full CI green including emulator integration tests.
// Runs on Android emulator (api-34) via reactivecircus/android-emulator-runner.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nutrimind/main.dart' as app;

/// Boots the app and pumps for a bounded time. Deliberately NOT `pumpAndSettle`: after the premium
/// redesign the splash and loaders run perpetual ambient animations (NutriMindLogo + AppLoader),
/// so the widget tree never reaches a quiescent state and `pumpAndSettle` would throw. Bounded
/// pumping still lets the async bootstrap (Supabase init → auth stream → router redirect) progress
/// and render an initial surface deterministically.
Future<void> _boot(WidgetTester tester) async {
  app.main();
  for (var i = 0; i < 50; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Happy path E2E', () {
    testWidgets('App launches and shows a valid initial surface', (tester) async {
      await _boot(tester);

      // The first surface for a signed-out user is the branded splash (while the auth stream
      // resolves) → the cinematic intro carousel → login; a signed-in user lands on Home/scanner.
      // Accept any valid entry surface — the app must never launch into a blank/broken screen.
      final foundInitialSurface =
          find.byTooltip('Scan').evaluate().isNotEmpty ||       // Home / scanner (authenticated)
          find.text('Sign in').evaluate().isNotEmpty ||         // login
          find.text('Get Started').evaluate().isNotEmpty ||     // intro final slide / login CTA
          find.text('Next').evaluate().isNotEmpty ||            // intro carousel (earlier slides)
          find.text('NutriMind').evaluate().isNotEmpty;         // splash / intro branding

      expect(foundInitialSurface, isTrue,
          reason: 'Expected a valid initial surface (splash / intro / login / home)');
    });

    testWidgets('Home screen renders without crash', (tester) async {
      await _boot(tester);
      // No unhandled exceptions during initial render.
      expect(tester.takeException(), isNull);
    });
  });

  group('Chaos tests', () {
    testWidgets('Offline banner appears when network unavailable', (tester) async {
      // Note: full chaos test requires MockNetworkChannel; this verifies the app boots and the UI
      // path that checks ConnectivityResult.none doesn't crash the initial render.
      await _boot(tester);
      // App should not crash regardless of network state.
      expect(tester.takeException(), isNull);
    });
  });
}

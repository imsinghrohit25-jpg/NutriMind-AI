import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/core/design_system/components/app_loader.dart';
import 'package:nutrimind/core/design_system/theme.dart';

Widget _host(Widget child, {bool reduceMotion = false}) => MaterialApp(
      theme: buildLightTheme(),
      home: Scaffold(
        body: MediaQuery(
          data: MediaQueryData(disableAnimations: reduceMotion),
          child: Center(child: child),
        ),
      ),
    );

void main() {
  testWidgets('renders the branded loader (a CustomPaint arc)', (tester) async {
    await tester.pumpWidget(_host(const AppLoader()));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.byType(AppLoader), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
  });

  testWidgets('shows an optional label', (tester) async {
    await tester.pumpWidget(_host(const AppLoader(label: 'Resolving…')));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.text('Resolving…'), findsOneWidget);
  });

  testWidgets('renders (static) under reduce-motion without throwing', (tester) async {
    await tester.pumpWidget(_host(const AppLoader(), reduceMotion: true));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.byType(AppLoader), findsOneWidget);
  });

  testWidgets('AppLoader.centered builds a centered loader', (tester) async {
    await tester.pumpWidget(_host(AppLoader.centered(label: 'Loading')));
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.byType(AppLoader), findsOneWidget);
    expect(find.text('Loading'), findsOneWidget);
  });
}

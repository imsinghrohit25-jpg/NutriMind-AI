import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind/core/design_system/app_palette.dart';
import 'package:nutrimind/core/design_system/theme.dart';
import 'package:nutrimind/core/design_system/tokens.dart';

/// Relative luminance per WCAG 2.1.
double _luminance(Color c) {
  double chan(double v) {
    v = v / 255.0;
    return v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  }

  final r = chan((c.r * 255).roundToDouble());
  final g = chan((c.g * 255).roundToDouble());
  final b = chan((c.b * 255).roundToDouble());
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

double _contrast(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  final hi = math.max(la, lb);
  final lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  group('AppPalette resolves per active theme', () {
    testWidgets('light theme yields the light palette', (tester) async {
      late AppPalette resolved;
      await tester.pumpWidget(MaterialApp(
        theme: buildLightTheme(),
        home: Builder(builder: (context) {
          resolved = context.colors;
          return const SizedBox();
        }),
      ));
      expect(resolved.subtle, AppColors.subtle);
      expect(resolved.surface, AppColors.surface);
      expect(resolved.onSurface, AppColors.onSurface);
      expect(resolved.primary, AppColors.primary);
    });

    testWidgets('dark theme yields the dark palette', (tester) async {
      late AppPalette resolved;
      await tester.pumpWidget(MaterialApp(
        theme: buildLightTheme(),
        darkTheme: buildDarkTheme(),
        themeMode: ThemeMode.dark,
        home: Builder(builder: (context) {
          resolved = context.colors;
          return const SizedBox();
        }),
      ));
      expect(resolved.subtle, AppColorsDark.subtle);
      expect(resolved.surface, AppColorsDark.surface);
      expect(resolved.onSurface, AppColorsDark.onSurface);
      expect(resolved.primary, AppColorsDark.primary);
    });
  });

  group('WCAG AA contrast holds in both palettes', () {
    // Body text (onSurface/onBackground) must clear 4.5:1; secondary "subtle" text is used at
    // >=14px semibold or as large/label text, so it clears the 3:1 large-text threshold.
    for (final entry in {'light': AppPalette.light, 'dark': AppPalette.dark}.entries) {
      final name = entry.key;
      final p = entry.value;
      test('$name: onSurface on surface >= 4.5', () {
        expect(_contrast(p.onSurface, p.surface), greaterThanOrEqualTo(4.5));
      });
      test('$name: onBackground on background >= 4.5', () {
        expect(_contrast(p.onBackground, p.background), greaterThanOrEqualTo(4.5));
      });
      test('$name: subtle on surface >= 3.0 (large/label text)', () {
        expect(_contrast(p.subtle, p.surface), greaterThanOrEqualTo(3.0));
      });
      test('$name: subtle on background >= 3.0 (large/label text)', () {
        expect(_contrast(p.subtle, p.background), greaterThanOrEqualTo(3.0));
      });
    }
  });
}

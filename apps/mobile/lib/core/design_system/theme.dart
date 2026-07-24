import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'app_palette.dart';
import 'tokens.dart';

// Shared-axis / fade-through page transitions (ADR-0034) applied app-wide via ThemeData, exactly
// as Phase 2 of the redesign spec requires — one central place, not per-route configuration.
// iOS keeps CupertinoPageTransitionsBuilder so native swipe-back is never affected. As of this
// Flutter SDK, CupertinoPageTransitionsBuilder lives in cupertino/route.dart and is no longer
// re-exported by material.dart, so it needs its own explicit import (found by actually compiling
// this — a real SDK reorganization, not a typo).
const _pageTransitionsTheme = PageTransitionsTheme(
  builders: {
    TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
    TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
  },
);

TextTheme _appTextTheme(Color onSurface, Color subtle) => TextTheme(
  displayLarge: AppFonts.display(AppType.displayLarge).copyWith(color: onSurface),
  displayMedium: AppFonts.display(AppType.displayMedium).copyWith(color: onSurface),
  displaySmall: AppFonts.display(AppType.displaySmall).copyWith(color: onSurface),
  headlineLarge: AppFonts.display(AppType.headlineLarge).copyWith(color: onSurface),
  headlineMedium: AppFonts.display(AppType.headlineMedium).copyWith(color: onSurface),
  titleLarge: AppFonts.body(AppType.titleLarge).copyWith(color: onSurface),
  titleMedium: AppFonts.body(AppType.titleMedium).copyWith(color: onSurface),
  titleSmall: AppFonts.body(AppType.titleSmall).copyWith(color: onSurface),
  bodyLarge: AppFonts.body(AppType.bodyLarge).copyWith(color: onSurface),
  bodyMedium: AppFonts.body(AppType.bodyMedium).copyWith(color: onSurface),
  bodySmall: AppFonts.body(AppType.bodySmall).copyWith(color: subtle),
  labelLarge: AppFonts.body(AppType.labelLarge).copyWith(color: onSurface),
  labelMedium: AppFonts.body(AppType.labelMedium).copyWith(color: subtle),
  labelSmall: AppFonts.body(AppType.labelSmall).copyWith(color: subtle),
);

ThemeData buildLightTheme() {
  final base = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: Brightness.light,
    primary: AppColors.primary,
    secondary: AppColors.accent,
    error: AppColors.error,
    surface: AppColors.surface,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: AppColors.background,
    extensions: const [AppPalette.light],
    pageTransitionsTheme: _pageTransitionsTheme,
    textTheme: _appTextTheme(AppColors.onSurface, AppColors.subtle),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.surface,
      foregroundColor: AppColors.onSurface,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: AppFonts.body(AppType.titleLarge).copyWith(color: AppColors.onSurface),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        side: const BorderSide(color: AppColors.divider),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        ),
        textStyle: AppType.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        minimumSize: const Size(double.infinity, 52),
        side: const BorderSide(color: AppColors.primary),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        ),
        textStyle: AppType.labelLarge,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surfaceVariant,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.l,
        vertical: AppSpacing.m,
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.divider,
      thickness: 1,
      space: 0,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.surface,
      selectedItemColor: AppColors.primary,
      unselectedItemColor: AppColors.subtle,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
  );
}

/// Dark theme (ADR-0034) — same structural shape as [buildLightTheme], driven by
/// [AppColorsDark] token-for-token so the two never drift out of sync ad hoc.
ThemeData buildDarkTheme() {
  final base = ColorScheme.fromSeed(
    seedColor: AppColorsDark.primary,
    brightness: Brightness.dark,
    primary: AppColorsDark.primary,
    secondary: AppColorsDark.accent,
    error: AppColorsDark.error,
    surface: AppColorsDark.surface,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: AppColorsDark.background,
    extensions: const [AppPalette.dark],
    pageTransitionsTheme: _pageTransitionsTheme,
    textTheme: _appTextTheme(AppColorsDark.onSurface, AppColorsDark.subtle),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColorsDark.surface,
      foregroundColor: AppColorsDark.onSurface,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: AppFonts.body(AppType.titleLarge).copyWith(color: AppColorsDark.onSurface),
    ),
    cardTheme: CardThemeData(
      color: AppColorsDark.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        side: const BorderSide(color: AppColorsDark.divider),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColorsDark.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        ),
        textStyle: AppType.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColorsDark.primary,
        minimumSize: const Size(double.infinity, 52),
        side: const BorderSide(color: AppColorsDark.primary),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        ),
        textStyle: AppType.labelLarge,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColorsDark.surfaceVariant,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.l,
        vertical: AppSpacing.m,
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColorsDark.divider,
      thickness: 1,
      space: 0,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColorsDark.surface,
      selectedItemColor: AppColorsDark.primary,
      unselectedItemColor: AppColorsDark.subtle,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
  );
}

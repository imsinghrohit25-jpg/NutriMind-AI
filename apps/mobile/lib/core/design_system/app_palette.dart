import 'package:flutter/material.dart';
import 'tokens.dart';

/// Brightness-aware semantic palette (Phase 5 — full dark/light theming).
///
/// Before this, ~50 screens referenced the static light-only [AppColors] directly, so wiring a
/// dark theme would have left light-colored text/surfaces on dark backgrounds. [AppPalette] is a
/// [ThemeExtension] carrying every token that legitimately differs between light and dark; screens
/// read it via `context.colors.<token>` and it resolves to the active theme automatically.
///
/// Deliberately EXCLUDED (stay on the static [AppColors]): the health-score bands
/// (`scoreExcellent…scoreBad`) and veg marks — these carry regulatory/food-safety meaning and must
/// NOT shift between themes (same decision recorded on [AppColorsDark]).
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.primary,
    required this.primaryLight,
    required this.primaryDark,
    required this.accent,
    required this.accentLight,
    required this.success,
    required this.warning,
    required this.error,
    required this.info,
    required this.background,
    required this.surface,
    required this.surfaceVariant,
    required this.onBackground,
    required this.onSurface,
    required this.subtle,
    required this.divider,
  });

  final Color primary;
  final Color primaryLight;
  final Color primaryDark;
  final Color accent;
  final Color accentLight;
  final Color success;
  final Color warning;
  final Color error;
  final Color info;
  final Color background;
  final Color surface;
  final Color surfaceVariant;
  final Color onBackground;
  final Color onSurface;
  final Color subtle;
  final Color divider;

  /// Light palette — sourced token-for-token from the original [AppColors] so existing light-mode
  /// rendering is byte-identical to before this migration.
  static const AppPalette light = AppPalette(
    primary: AppColors.primary,
    primaryLight: AppColors.primaryLight,
    primaryDark: AppColors.primaryDark,
    accent: AppColors.accent,
    accentLight: AppColors.accentLight,
    success: AppColors.success,
    warning: AppColors.warning,
    error: AppColors.error,
    info: AppColors.info,
    background: AppColors.background,
    surface: AppColors.surface,
    surfaceVariant: AppColors.surfaceVariant,
    onBackground: AppColors.onBackground,
    onSurface: AppColors.onSurface,
    subtle: AppColors.subtle,
    divider: AppColors.divider,
  );

  /// Dark palette — sourced from [AppColorsDark].
  static const AppPalette dark = AppPalette(
    primary: AppColorsDark.primary,
    primaryLight: AppColorsDark.primaryLight,
    primaryDark: AppColorsDark.primaryDark,
    accent: AppColorsDark.accent,
    accentLight: AppColorsDark.accentLight,
    success: AppColorsDark.success,
    warning: AppColorsDark.warning,
    error: AppColorsDark.error,
    info: AppColorsDark.info,
    background: AppColorsDark.background,
    surface: AppColorsDark.surface,
    surfaceVariant: AppColorsDark.surfaceVariant,
    onBackground: AppColorsDark.onBackground,
    onSurface: AppColorsDark.onSurface,
    subtle: AppColorsDark.subtle,
    divider: AppColorsDark.divider,
  );

  @override
  AppPalette copyWith({
    Color? primary,
    Color? primaryLight,
    Color? primaryDark,
    Color? accent,
    Color? accentLight,
    Color? success,
    Color? warning,
    Color? error,
    Color? info,
    Color? background,
    Color? surface,
    Color? surfaceVariant,
    Color? onBackground,
    Color? onSurface,
    Color? subtle,
    Color? divider,
  }) {
    return AppPalette(
      primary: primary ?? this.primary,
      primaryLight: primaryLight ?? this.primaryLight,
      primaryDark: primaryDark ?? this.primaryDark,
      accent: accent ?? this.accent,
      accentLight: accentLight ?? this.accentLight,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      info: info ?? this.info,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceVariant: surfaceVariant ?? this.surfaceVariant,
      onBackground: onBackground ?? this.onBackground,
      onSurface: onSurface ?? this.onSurface,
      subtle: subtle ?? this.subtle,
      divider: divider ?? this.divider,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      primary: Color.lerp(primary, other.primary, t)!,
      primaryLight: Color.lerp(primaryLight, other.primaryLight, t)!,
      primaryDark: Color.lerp(primaryDark, other.primaryDark, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentLight: Color.lerp(accentLight, other.accentLight, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      info: Color.lerp(info, other.info, t)!,
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceVariant: Color.lerp(surfaceVariant, other.surfaceVariant, t)!,
      onBackground: Color.lerp(onBackground, other.onBackground, t)!,
      onSurface: Color.lerp(onSurface, other.onSurface, t)!,
      subtle: Color.lerp(subtle, other.subtle, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
    );
  }
}

/// `context.colors.subtle` etc. — resolves the active [AppPalette] from the nearest theme. Every
/// screen migrated off the static [AppColors] neutrals/brand/semantic tokens reads through here.
extension AppPaletteContext on BuildContext {
  AppPalette get colors =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}

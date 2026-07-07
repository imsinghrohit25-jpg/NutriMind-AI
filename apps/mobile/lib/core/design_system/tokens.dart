import 'package:flutter/material.dart';

// Design tokens — single source of truth for colors, spacing, type scale.
// India-first palette: deep green (health) + saffron accent.

abstract final class AppColors {
  // Brand
  static const primary = Color(0xFF1B6B3A);       // Deep forest green
  static const primaryLight = Color(0xFF4C9E6B);
  static const primaryDark = Color(0xFF0D4422);
  static const accent = Color(0xFFE8851A);         // Saffron orange
  static const accentLight = Color(0xFFFFA94D);

  // Semantic
  static const success = Color(0xFF2E7D32);
  static const warning = Color(0xFFF57C00);
  static const error = Color(0xFFC62828);
  static const info = Color(0xFF1565C0);

  // Score bands (health score 0–100)
  static const scoreExcellent = Color(0xFF2E7D32);   // 80–100
  static const scoreGood      = Color(0xFF558B2F);   // 60–79
  static const scoreFair      = Color(0xFFF57C00);   // 40–59
  static const scorePoor      = Color(0xFFD84315);   // 20–39
  static const scoreBad       = Color(0xFFC62828);   // 0–19

  // Neutral
  static const background = Color(0xFFF7F9F7);
  static const surface    = Color(0xFFFFFFFF);
  static const surfaceVariant = Color(0xFFEEF2EE);
  static const onBackground = Color(0xFF1A1F1A);
  static const onSurface    = Color(0xFF1A1F1A);
  static const subtle       = Color(0xFF6B7B6B);
  static const divider      = Color(0xFFDDE5DD);

  // Veg marks
  static const vegGreen = Color(0xFF2E7D32);
  static const vegRed   = Color(0xFFC62828);
}

abstract final class AppSpacing {
  static const xxs = 2.0;
  static const xs  = 4.0;
  static const s   = 8.0;
  static const m   = 12.0;
  static const l   = 16.0;
  static const xl  = 24.0;
  static const xxl = 32.0;
  static const xxxl = 48.0;

  static const cardRadius    = 16.0;
  static const chipRadius    = 8.0;
  static const buttonRadius  = 12.0;
  static const sheetRadius   = 24.0;
}

abstract final class AppType {
  static const displayLarge  = TextStyle(fontSize: 36, fontWeight: FontWeight.w700, height: 1.2);
  static const displayMedium = TextStyle(fontSize: 28, fontWeight: FontWeight.w700, height: 1.2);
  static const displaySmall  = TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.2);
  static const headlineLarge = TextStyle(fontSize: 22, fontWeight: FontWeight.w600, height: 1.3);
  static const headlineMedium= TextStyle(fontSize: 20, fontWeight: FontWeight.w600, height: 1.3);
  static const titleLarge    = TextStyle(fontSize: 18, fontWeight: FontWeight.w600, height: 1.4);
  static const titleMedium   = TextStyle(fontSize: 16, fontWeight: FontWeight.w500, height: 1.4);
  static const titleSmall    = TextStyle(fontSize: 14, fontWeight: FontWeight.w500, height: 1.4);
  static const bodyLarge     = TextStyle(fontSize: 16, fontWeight: FontWeight.w400, height: 1.5);
  static const bodyMedium    = TextStyle(fontSize: 14, fontWeight: FontWeight.w400, height: 1.5);
  static const bodySmall     = TextStyle(fontSize: 12, fontWeight: FontWeight.w400, height: 1.4);
  static const labelLarge    = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.2);
  static const labelMedium   = TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.2);
  static const labelSmall    = TextStyle(fontSize: 11, fontWeight: FontWeight.w500, height: 1.2);
}

Color scoreColor(double score) {
  if (score >= 80) return AppColors.scoreExcellent;
  if (score >= 60) return AppColors.scoreGood;
  if (score >= 40) return AppColors.scoreFair;
  if (score >= 20) return AppColors.scorePoor;
  return AppColors.scoreBad;
}

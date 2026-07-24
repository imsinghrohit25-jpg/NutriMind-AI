import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// Design tokens — single source of truth for colors, spacing, type scale.
// Global brand palette: deep green (health) + saffron accent.
//
// Premium redesign (ADR-0034/0035/0036): extends this file in place rather than replacing it —
// every name below existed before the redesign and is used, unchanged, by ~50 screens. New
// tokens (AppColorsDark, AppGlass, AppMotion, AppElevation) are additive only.

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

/// Dark-theme semantic palette (ADR-0034) — same brand hues as [AppColors], re-tuned for
/// dark surfaces (Oura-style "premium calm" rather than a naive black-on-white inversion).
/// Score bands and veg marks are brightness-agnostic (kept from [AppColors] directly) since
/// they carry regulatory/food-safety meaning that must not shift between themes.
abstract final class AppColorsDark {
  static const primary = Color(0xFF4C9E6B);
  static const primaryLight = Color(0xFF7BC493);
  static const primaryDark = Color(0xFF1B6B3A);
  static const accent = Color(0xFFFFA94D);
  static const accentLight = Color(0xFFFFC078);

  static const success = Color(0xFF66BB6A);
  static const warning = Color(0xFFFFB74D);
  static const error = Color(0xFFEF5350);
  static const info = Color(0xFF64B5F6);

  static const background = Color(0xFF0B120D);
  static const surface = Color(0xFF12190F); // deep, not pure black
  static const surfaceVariant = Color(0xFF1B241A);
  static const onBackground = Color(0xFFE8EDE6);
  static const onSurface = Color(0xFFE8EDE6);
  static const subtle = Color(0xFF9BAE9B);
  static const divider = Color(0xFF2A342A);
}

/// Glassmorphism tokens (ADR-0034) — the ONLY place blur sigma / glass border / glass fill
/// values are defined. Governance rule: no screen may hardcode a `BackdropFilter` sigma or glass
/// border color; consume these. Kept deliberately small (perf budget: max 2-3 active blur layers
/// per screen — see docs/design/MOTION.md and the Phase 0 gallery for the enforced ceiling).
abstract final class AppGlass {
  // Sigma/opacity values match the original auth-screen GlassCard exactly (features/auth/
  // widgets/auth_ui.dart, pre-redesign) — promoting the component to the design system must not
  // shift how the already-shipped, already-tested auth screens look.
  static const blurSigma = 20.0;
  static const blurSigmaLight = 10.0; // for smaller/secondary glass panels
  static const fillOpacityDark = 0.14;
  static const fillOpacityLight = 0.55;
  static const borderOpacityDark = 0.25;
  static const borderOpacityLight = 0.35;

  static Color fill(Brightness b) => b == Brightness.dark
      ? Colors.white.withValues(alpha: fillOpacityDark)
      : Colors.white.withValues(alpha: fillOpacityLight);

  static Color border(Brightness b) => b == Brightness.dark
      ? Colors.white.withValues(alpha: borderOpacityDark)
      : Colors.white.withValues(alpha: borderOpacityLight);
}

/// Elevation / shadow scale (ADR-0034) — replaces ad-hoc `BoxShadow(...)` literals in screens.
abstract final class AppElevation {
  static List<BoxShadow> card(Brightness b) => [
    BoxShadow(
      color: (b == Brightness.dark ? Colors.black : AppColors.primaryDark).withValues(alpha: b == Brightness.dark ? 0.4 : 0.08),
      blurRadius: 24,
      offset: const Offset(0, 8),
    ),
  ];

  static List<BoxShadow> floating(Brightness b) => [
    BoxShadow(
      color: (b == Brightness.dark ? Colors.black : AppColors.primaryDark).withValues(alpha: b == Brightness.dark ? 0.5 : 0.12),
      blurRadius: 32,
      offset: const Offset(0, 12),
    ),
  ];
}

/// Motion tokens (ADR-0035, docs/design/MOTION.md) — the ONLY place animation durations/curves
/// are defined. Governance rule: no screen may write a raw `Duration(milliseconds: ...)` for an
/// animation; consume these named tiers instead.
abstract final class AppMotion {
  // Duration tiers
  static const micro = Duration(milliseconds: 150);       // press states, toggles
  static const standard = Duration(milliseconds: 300);    // page elements, card entrances
  static const cinematic = Duration(milliseconds: 600);   // hero moments (score ring, onboarding)

  // Signature easing — one curve family used everywhere for consistency.
  static const enter = Curves.easeOutCubic;
  static const exit = Curves.easeInCubic;
  static const emphasized = Curves.easeOutBack; // small overshoot, used sparingly (press/success)

  // Stagger interval between successive list/card entrances.
  static const staggerStep = Duration(milliseconds: 60);
}

/// Typography faces (ADR-0034: Sora display + Inter body — Google Fonts, open license, distinct
/// from Apple Health/WHOOP/Oura's system/proprietary faces). Loaded once and reused so
/// [AppType]'s TextStyles below can attach a face without every call site importing google_fonts.
abstract final class AppFonts {
  static TextStyle get _displayBase => GoogleFonts.sora();
  static TextStyle get _bodyBase => GoogleFonts.inter();

  static TextStyle display(TextStyle base) => _displayBase.merge(base);
  static TextStyle body(TextStyle base) => _bodyBase.merge(base);
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

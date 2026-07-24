import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Central haptic feedback service (Phase 5 — Global Polish). Before this, `HapticFeedback.*` was
/// called ad hoc from a handful of screens with no way to disable it app-wide and no semantic
/// naming. Every haptic in the app now goes through here so:
///   - a single [enabled] switch can mute all haptics (wired to a user setting), and
///   - call sites express intent (`success`/`warning`/`selection`) rather than a raw impact level.
///
/// Deliberately a plain static utility (like [AppMotion]/[AppFonts]) — no provider/DI — because a
/// haptic is a fire-and-forget side effect with no state to observe; the one mutable bit ([enabled])
/// is a global preference, not per-widget state.
abstract final class HapticService {
  /// Master switch. Default on; a settings toggle flips this to silence all haptics app-wide.
  /// (Kept as a simple mutable static rather than a provider — nothing rebuilds on its change.)
  static bool enabled = true;

  static bool _suppressed(BuildContext? context) {
    if (!enabled) return true;
    // Users who turn on OS "reduce motion" often want tactile feedback dialed back too; honor it
    // when a context is available. Falls back to [enabled]-only when called without one.
    if (context != null && MediaQuery.of(context).disableAnimations) return true;
    return false;
  }

  /// Light tap — passive UI feedback (toggles, minor selections).
  static void light({BuildContext? context}) {
    if (_suppressed(context)) return;
    HapticFeedback.lightImpact();
  }

  /// Medium tap — primary button presses, confirmations.
  static void medium({BuildContext? context}) {
    if (_suppressed(context)) return;
    HapticFeedback.mediumImpact();
  }

  /// Heavy tap — reserved for high-salience safety moments (allergen hard-gate).
  static void heavy({BuildContext? context}) {
    if (_suppressed(context)) return;
    HapticFeedback.heavyImpact();
  }

  /// Discrete selection tick — carousel page change, chip selection.
  static void selection({BuildContext? context}) {
    if (_suppressed(context)) return;
    HapticFeedback.selectionClick();
  }

  /// Semantic: a successful, safe outcome (medium impact).
  static void success({BuildContext? context}) => medium(context: context);

  /// Semantic: a cautionary result the user should notice (heavy impact).
  static void warning({BuildContext? context}) => heavy(context: context);

  /// Semantic: an error / rejected action (heavy impact).
  static void error({BuildContext? context}) => heavy(context: context);
}

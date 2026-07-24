import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../offline/local_db.dart';

/// App-wide light/dark/system theme selection, persisted device-globally (Phase 5).
///
/// Declared as a plain [NotifierProvider] rather than riverpod-codegen: it needs no generated
/// family/args and this keeps the theme feature self-contained (no build_runner step). The initial
/// value is [ThemeMode.system]; the persisted choice loads asynchronously on first build and
/// updates state once read (a brief system-default first frame is acceptable and matches most
/// users' expectation).
final themeModeProvider =
    NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

class ThemeModeController extends Notifier<ThemeMode> {
  static const _flagKey = 'theme_mode';

  @override
  ThemeMode build() {
    _load();
    return ThemeMode.system;
  }

  Future<void> _load() async {
    final stored = await ref.read(localDbProvider).getGlobalFlag(_flagKey);
    final mode = _parse(stored);
    if (mode != state) state = mode;
  }

  /// Set and persist an explicit mode.
  Future<void> set(ThemeMode mode) async {
    state = mode;
    await ref.read(localDbProvider).setGlobalFlag(_flagKey, mode.name);
  }

  /// Cycle light ⇄ dark. From [ThemeMode.system] the first tap goes to dark so the control always
  /// produces a visible change regardless of the current platform brightness.
  Future<void> toggle() => set(switch (state) {
        ThemeMode.light => ThemeMode.dark,
        ThemeMode.dark => ThemeMode.light,
        ThemeMode.system => ThemeMode.dark,
      });

  static ThemeMode _parse(String? v) => switch (v) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };
}

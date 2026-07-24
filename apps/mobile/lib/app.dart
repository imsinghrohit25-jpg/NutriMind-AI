import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nutrimind_localization_engine/nutrimind_localization_engine.dart';

import 'core/design_system/theme.dart';
import 'core/design_system/theme_mode.dart';
import 'core/router/router.dart';
import 'core/offline/sync_engine.dart';
import 'l10n/app_localizations.dart';

class NutriMindApp extends ConsumerWidget {
  const NutriMindApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router    = ref.watch(routerProvider);
    final locale    = ref.watch(activeLocaleProvider);
    final direction = ref.watch(activeTextDirectionProvider);
    final themeMode = ref.watch(themeModeProvider);

    // Start auto-sync listener — no-op if offline.
    ref.watch(autoSyncProvider);

    return Directionality(
      textDirection: direction,
      child: MaterialApp.router(
        title: 'NutriMind',
        theme: buildLightTheme(),
        darkTheme: buildDarkTheme(),
        themeMode: themeMode,
        routerConfig: router,
        debugShowCheckedModeBanner: false,
        // Phase 2: multi-locale + RTL support (gated by feature flags).
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
        ],
      ),
    );
  }
}

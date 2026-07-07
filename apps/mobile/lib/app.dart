import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/design_system/theme.dart';
import 'core/router/router.dart';
import 'core/offline/sync_engine.dart';

class NutriMindApp extends ConsumerWidget {
  const NutriMindApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    // Start auto-sync listener — no-op if offline.
    ref.watch(autoSyncProvider);

    return MaterialApp.router(
      title: 'NutriMind',
      theme: buildLightTheme(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}

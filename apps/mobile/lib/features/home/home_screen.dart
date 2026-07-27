import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/design_system/components/glass_card.dart';
import '../../core/design_system/components/gradient_scaffold.dart';
import '../../core/design_system/components/nutrient_ring.dart';
import '../../core/design_system/components/nutrimind_logo.dart';
import '../../core/design_system/components/shimmer_skeleton.dart';
import '../../core/design_system/components/stat_chip.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/haptic_service.dart';
import '../../core/design_system/theme_mode.dart';
import '../../core/design_system/tokens.dart';
import '../../core/offline/local_db.dart';
import '../../core/router/routes.dart';
import '../../features/auth/auth_state.dart';
import '../disease_chips/disease_guidance_provider.dart';
import '../history_search/history_search_provider.dart';
import '../history_search/history_search_screen.dart';
import '../meals/daily_dashboard.dart';
import '../meals/meal_log_screen.dart';
import '../meals/meals_providers.dart';
import '../reports/weekly_report_screen.dart';
import '../product/product_screen.dart';

/// Time-of-day-aware greeting — real wall-clock data, not a canned string.
String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authStateProvider);
    final user = authAsync.valueOrNull?.user;
    final recentProductsAsync = ref.watch(recentScannedProductsProvider);
    final scansTodayAsync = ref.watch(scansTodayProvider);
    final scansToday = scansTodayAsync.valueOrNull ?? 0;
    final diseaseGuidanceAsync = ref.watch(diseaseGuidanceProvider);
    final mealDayAsync = ref.watch(mealDayReportProvider);

    return GradientScaffold(
      appBar: AppBar(
        title: const Text('NutriMind'),
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            icon: Icon(switch (ref.watch(themeModeProvider)) {
              ThemeMode.light => Icons.light_mode_outlined,
              ThemeMode.dark => Icons.dark_mode_outlined,
              ThemeMode.system => Icons.brightness_auto_outlined,
            }),
            onPressed: () {
              HapticService.selection(context: context);
              ref.read(themeModeProvider.notifier).toggle();
            },
            tooltip: 'Toggle light / dark theme',
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push(AppRoutes.profile),
            tooltip: 'Profile',
          ),
          // No settings shell exists yet (see router.dart's own comment on that gap) — sign out
          // lives here for now, the one place every authenticated user already passes through.
          // GoRouter's redirect (core/router/router.dart) sends the user back to /login
          // automatically once onAuthStateChange reports no session — no manual nav needed.
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => Supabase.instance.client.auth.signOut(),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          // Pull-to-refresh re-reads the on-device cache + re-fetches condition guidance. Reuses
          // the existing providers — no new data source.
          onRefresh: () async {
            ref.invalidate(recentScannedProductsProvider);
            ref.invalidate(scansTodayProvider);
            ref.invalidate(diseaseGuidanceProvider);
            ref.invalidate(mealDayReportProvider);
            await Future.wait([
              ref.read(recentScannedProductsProvider.future),
              ref.read(scansTodayProvider.future),
            ]);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_greeting()}${user != null && user.email.isNotEmpty ? ", ${user.email.split('@').first}" : ""}',
                          style: Theme.of(context).textTheme.displaySmall,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text('Scan a product to check its nutrition', style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: context.colors.subtle)),
                      ],
                    ),
                  ),
                  NutriMindLogo(size: 56, state: scansToday > 0 ? NutriMindMoodState.celebrating : NutriMindMoodState.idle),
                ],
              ).animate().fadeIn(duration: AppMotion.standard),

              const SizedBox(height: AppSpacing.xl),

              // Real-data stat card — today's scan count + last scanned product, straight from
              // the on-device cache (ADR-0038). Shimmer while loading, honest empty state if the
              // user hasn't scanned anything yet — never a zero-filled fake chart.
              recentProductsAsync.when(
                loading: () => const GlassCard.static(
                  child: SizedBox(height: 96, child: Center(child: ShimmerSkeleton(width: 220))),
                ),
                error: (_, __) => const SizedBox.shrink(),
                data: (products) => products.isEmpty
                    ? _EmptyScanState(onScan: () => context.push(AppRoutes.scanner))
                    : _LastScannedCard(product: products.first, scansToday: scansToday),
              ).animate().fadeIn(duration: AppMotion.standard, delay: AppMotion.staggerStep),

              // Recently-scanned strip — surfaces the other products the recentProducts provider
              // already fetches (the card above shows only the latest). Pure reuse, no new query.
              recentProductsAsync.maybeWhen(
                data: (products) => products.length > 1
                    ? Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.l),
                        child: _RecentScansStrip(products: products.skip(1).toList()),
                      )
                    : const SizedBox.shrink(),
                orElse: () => const SizedBox.shrink(),
              ),

              // Condition-aware guidance — the signed-in user's stored health conditions, from the
              // existing deterministic /v1/disease/guidance engine. Hidden when there are none.
              diseaseGuidanceAsync.maybeWhen(
                data: (g) => g.isEmpty
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.l),
                        child: _HealthConditionCard(guidance: g),
                      ),
                orElse: () => const SizedBox.shrink(),
              ),

              // Today's nutrition — real logged-meal totals vs the user's personalised budget
              // (engine-computed via /v1/meals/day). Honest empty state; never fabricated numbers.
              mealDayAsync.maybeWhen(
                data: (report) => Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.l),
                  child: _TodayNutritionCard(
                    report: report,
                    onOpen: () {
                      final route = report.gapReport != null
                          ? MaterialPageRoute<void>(builder: (_) => DailyDashboard(gapReport: report.gapReport!))
                          : MaterialPageRoute<void>(builder: (_) => MealLogScreen(entries: report.entries, total: report.total));
                      Navigator.of(context).push(route);
                    },
                  ),
                ),
                orElse: () => const SizedBox.shrink(),
              ),

              const SizedBox(height: AppSpacing.xxxl),

              // Primary CTA — barcode scanner
              // NOTE: `.push()`, not `.go()` — `.go()` replaces the whole GoRouter stack, so with
              // Home as the app's root, back-press from a screen reached via `.go()` had nothing
              // left to pop to and exited the app entirely instead of returning to Home.
              _HomeCard(
                icon: Icons.qr_code_scanner,
                color: context.colors.primary,
                title: 'Scan barcode',
                subtitle: 'EAN-13, EAN-8, UPC — products worldwide',
                onTap: () => context.push(AppRoutes.scanner),
                index: 0,
              ),
              const SizedBox(height: AppSpacing.l),

              // Secondary CTA — label OCR. Previously routed to the exact same barcode-only
              // scanner as the card above, so this silently never reached the OCR flow at all —
              // `mode=label` selects the label-capture UI (see router.dart + scanner_screen.dart).
              _HomeCard(
                icon: Icons.document_scanner_outlined,
                color: context.colors.accent,
                title: 'Scan nutrition label',
                subtitle: 'Photograph the nutrition facts panel',
                onTap: () => context.push('${AppRoutes.scanner}?mode=label'),
                index: 1,
              ),
              const SizedBox(height: AppSpacing.l),

              // AI meal photo recognition (production audit 2026-07) — the backend
              // /v1/scans/meal pipeline existed but had no camera mode or entry point at all.
              _HomeCard(
                icon: Icons.restaurant,
                color: context.colors.warning,
                title: 'Snap a meal',
                subtitle: 'AI identifies dishes, portions, and nutrition',
                onTap: () => context.push('${AppRoutes.scanner}?mode=meal'),
                index: 2,
              ),
              const SizedBox(height: AppSpacing.l),

              // Household
              _HomeCard(
                icon: Icons.family_restroom,
                color: AppColors.scoreGood,
                title: 'Household',
                subtitle: 'Manage profiles for your family',
                onTap: () => context.push(AppRoutes.household),
                index: 3,
              ),
              const SizedBox(height: AppSpacing.l),

              // Diet Chat — Phase 13's multi-agent chat already exists and is fully wired
              // server-side (real streaming SSE, real Gemini-backed Supervisor graph) but had no
              // entry point anywhere in the UI.
              _HomeCard(
                icon: Icons.chat_bubble_outline,
                color: context.colors.info,
                title: 'Diet Chat',
                subtitle: 'Ask NutriMind about your diet',
                onTap: () => context.push(AppRoutes.agentChat),
                index: 4,
              ),
              const SizedBox(height: AppSpacing.l),

              // Meal Planner — backend (generate/view plan, grocery list) was fully built but had
              // no Home entry point and the client hit a dead `/api/v1/planner/...` path (see
              // routes.dart's own comment on that fix).
              _HomeCard(
                icon: Icons.calendar_today,
                color: context.colors.accent,
                title: 'Diet Plan',
                subtitle: 'Generate an AI meal plan and grocery list',
                onTap: () => context.push(AppRoutes.mealPlan),
                index: 5,
              ),
              const SizedBox(height: AppSpacing.l),

              // Food diary — the meal-log screen, fed by the same /v1/meals/day report the summary
              // card above uses (read from the provider on tap; no second fetch).
              _HomeCard(
                icon: Icons.restaurant_menu,
                color: AppColors.scoreGood,
                title: "Today's meals",
                subtitle: 'Your food diary and nutrition totals',
                onTap: () {
                  final report = ref.read(mealDayReportProvider).valueOrNull;
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => MealLogScreen(
                      entries: report?.entries ?? const [],
                      total: report?.total,
                    ),
                  ));
                },
                index: 6,
              ),
              const SizedBox(height: AppSpacing.l),

              // Weekly report — the same rendered report the weekly push job produces, fetched
              // on demand (GET /v1/meals/weekly) and shown in the existing WeeklyReportScreen.
              _HomeCard(
                icon: Icons.insights_outlined,
                color: context.colors.info,
                title: 'Weekly report',
                subtitle: 'Your 7-day nutrition wins and concerns',
                onTap: () async {
                  final wr = await ref.read(weeklyReportProvider.future);
                  if (!context.mounted) return;
                  if (wr.available && wr.report != null) {
                    Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => WeeklyReportScreen(report: wr.report!),
                    ));
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Log meals this week to see your weekly report')),
                    );
                  }
                },
                index: 7,
              ),
              const SizedBox(height: AppSpacing.l),

              // "What NutriMind knows about me" — Phase 11's AI memory transparency screen was
              // fully built and routed (AppRoutes.memory) but had no entry point in the UI.
              _HomeCard(
                icon: Icons.psychology_alt_outlined,
                color: context.colors.primaryLight,
                title: 'What NutriMind knows',
                subtitle: 'Review and manage your AI memory',
                onTap: () => context.push(AppRoutes.memory),
                index: 8,
              ),
              const SizedBox(height: AppSpacing.l),

              // Semantic scan-history search — natural-language search over past scans, backed by
              // the existing /v1/history/search (embed → match_scan_history RPC) + HistorySearchScreen.
              _HomeCard(
                icon: Icons.manage_search_outlined,
                color: context.colors.accent,
                title: 'Search history',
                subtitle: 'Find past scans, e.g. "high sodium snacks"',
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => HistorySearchScreen(onSearch: (q) => searchScanHistory(ref, q)),
                )),
                index: 9,
              ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyScanState extends StatelessWidget {
  const _EmptyScanState({required this.onScan});
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Row(
        children: [
          Icon(Icons.qr_code_scanner, size: 32, color: context.colors.primary),
          const SizedBox(width: AppSpacing.l),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('No scans yet', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(
                  'Scan your first product to see it here.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.colors.subtle),
                ),
              ],
            ),
          ),
          TextButton(onPressed: onScan, child: const Text('Scan')),
        ],
      ),
    );
  }
}

/// Real cached data only — energyKcal/proteinG/etc. come straight from LocalProducts, populated
/// the last time this exact product was resolved (ADR-0038). The ring's "2000 kcal reference" is
/// the same %DV convention printed on every nutrition facts panel — not a personalized target.
class _LastScannedCard extends StatelessWidget {
  const _LastScannedCard({required this.product, required this.scansToday});
  final LocalProduct product;
  final int scansToday;

  @override
  Widget build(BuildContext context) {
    final kcal = product.energyKcal;
    return GlassCard(
      child: InkWell(
        onTap: () {
          final Map<String, dynamic> productJson = jsonDecode(product.jsonPayload) as Map<String, dynamic>;
          Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => ProductScreen(productJson: productJson),
          ));
        },
        borderRadius: BorderRadius.circular(20),
        child: Row(
          children: [
            AnimatedNutrientRing(
              value: kcal ?? 0,
              maxValue: 2000,
              color: context.colors.primary,
              size: 72,
              strokeWidth: 8,
              label: 'kcal',
            ),
            const SizedBox(width: AppSpacing.l),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Last scanned', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: context.colors.subtle)),
                  Text(
                    product.name,
                    style: Theme.of(context).textTheme.titleMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.s),
                  Wrap(spacing: AppSpacing.xs, runSpacing: AppSpacing.xs, children: [
                    if (product.proteinG != null)
                      StatChip(label: 'protein', value: '${product.proteinG!.toStringAsFixed(0)}g'),
                    if (product.sodiumMg != null)
                      StatChip(label: 'sodium', value: '${product.sodiumMg!.toStringAsFixed(0)}mg', color: context.colors.warning),
                    if (scansToday > 0)
                      StatChip(label: scansToday == 1 ? 'scan today' : 'scans today', value: '$scansToday', color: context.colors.info),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeCard extends StatelessWidget {
  const _HomeCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.index,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final int index;

  @override
  Widget build(BuildContext context) {
    return GlassCard.static(
      padding: const EdgeInsets.all(AppSpacing.l),
      borderRadius: AppSpacing.cardRadius,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        child: Row(
          children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                color: color.withAlpha(20),
                borderRadius: BorderRadius.circular(AppSpacing.m),
              ),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(width: AppSpacing.l),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.colors.subtle)),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: context.colors.subtle),
          ],
        ),
      ),
    ).animate(delay: AppMotion.staggerStep * index)
        .fadeIn(duration: AppMotion.standard)
        .slideY(begin: 0.08, end: 0, duration: AppMotion.standard, curve: AppMotion.enter);
  }
}

/// Horizontal strip of the recently-scanned products the [recentScannedProductsProvider] already
/// fetches (beyond the single latest shown above). Each tile reuses the same cached [LocalProduct]
/// data and opens the existing [ProductScreen] — no new query, no new screen.
class _RecentScansStrip extends StatelessWidget {
  const _RecentScansStrip({required this.products});
  final List<LocalProduct> products;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Recently scanned', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: context.colors.subtle)),
        const SizedBox(height: AppSpacing.s),
        SizedBox(
          height: 84,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.s),
            itemBuilder: (context, i) {
              final p = products[i];
              return GestureDetector(
                onTap: () {
                  final json = jsonDecode(p.jsonPayload) as Map<String, dynamic>;
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => ProductScreen(productJson: json),
                  ));
                },
                child: GlassCard.static(
                  padding: const EdgeInsets.all(AppSpacing.m),
                  child: SizedBox(
                    width: 148,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          p.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        if (p.energyKcal != null)
                          Text(
                            '${p.energyKcal!.toStringAsFixed(0)} kcal',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: context.colors.subtle),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Compact summary of the signed-in user's health-condition guidance (deterministic engine output
/// from `/v1/disease/guidance`, reused via [diseaseGuidanceProvider]). Informational only, mirroring
/// the output-policy wording the on-product [DiseaseChipsWidget] already uses.
class _HealthConditionCard extends StatelessWidget {
  const _HealthConditionCard({required this.guidance});
  final DiseaseGuidance guidance;

  @override
  Widget build(BuildContext context) {
    final first = guidance.blocks.first;
    final avoid = (first['avoidFoods'] as List?)?.whereType<String>().toList() ?? const <String>[];
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.health_and_safety_outlined, color: context.colors.info, size: 20),
            const SizedBox(width: AppSpacing.s),
            Text('Your health conditions', style: Theme.of(context).textTheme.titleMedium),
          ]),
          const SizedBox(height: AppSpacing.m),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final b in guidance.blocks)
                StatChip(
                  label: (b['label'] as String?) ?? (b['condition'] as String? ?? 'condition'),
                  color: context.colors.info,
                ),
            ],
          ),
          if (avoid.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            Text(
              'Commonly limit: ${avoid.take(3).join(', ')}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.colors.subtle),
            ),
          ],
          const SizedBox(height: AppSpacing.s),
          Text(
            'General nutrition information, not medical advice.',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: context.colors.subtle),
          ),
        ],
      ),
    );
  }
}

/// Today's logged-meal calories vs the user's personalised budget (real /v1/meals/day data).
/// Ring maxes at the computed budget when available, else the standard 2000-kcal reference (the
/// same honest fallback ADR-0038 uses). Empty = nothing logged, shown as a real 0, not a fake total.
class _TodayNutritionCard extends StatelessWidget {
  const _TodayNutritionCard({required this.report, required this.onOpen});
  final MealDayReport report;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final consumed = report.consumedKcal;
    final budget = report.budgetKcal;
    final statusColor = switch (report.overallStatus) {
      'over' => context.colors.warning,
      'under' => context.colors.info,
      _ => AppColors.scoreGood,
    };
    return GlassCard(
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(20),
        child: Row(
          children: [
            AnimatedNutrientRing(
              value: consumed,
              maxValue: budget ?? 2000,
              color: statusColor,
              size: 72,
              strokeWidth: 8,
              label: 'kcal',
            ),
            const SizedBox(width: AppSpacing.l),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Today's nutrition", style: Theme.of(context).textTheme.labelSmall?.copyWith(color: context.colors.subtle)),
                  Text(
                    report.isEmpty ? 'No meals logged yet' : '${consumed.toStringAsFixed(0)} kcal logged',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.s),
                  if (report.isEmpty)
                    Text(
                      'Scan a product and add it to your diary',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.colors.subtle),
                    )
                  else if (budget != null)
                    Wrap(spacing: AppSpacing.xs, runSpacing: AppSpacing.xs, children: [
                      StatChip(
                        label: switch (report.overallStatus) {
                          'over' => 'over budget',
                          'under' => 'under budget',
                          _ => 'on track',
                        },
                        color: statusColor,
                      ),
                      StatChip(label: 'of ${budget.toStringAsFixed(0)} kcal', color: context.colors.subtle),
                    ]),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: context.colors.subtle),
          ],
        ),
      ),
    );
  }
}

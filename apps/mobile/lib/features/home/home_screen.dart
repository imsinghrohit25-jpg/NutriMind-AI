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
        child: SingleChildScrollView(
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
            ],
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

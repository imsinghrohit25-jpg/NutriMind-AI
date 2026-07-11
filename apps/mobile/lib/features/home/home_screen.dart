import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/design_system/tokens.dart';
import '../../core/router/routes.dart';
import '../../features/auth/auth_state.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authStateProvider);
    final user = authAsync.valueOrNull?.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('NutriMind'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.go(AppRoutes.profile),
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
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                user != null ? 'Hello${user.email.isNotEmpty ? ", ${user.email.split('@').first}" : ""}' : 'Hello',
                style: AppType.displaySmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text('Scan a product to check its nutrition', style: AppType.bodyLarge.copyWith(color: AppColors.subtle)),
              const SizedBox(height: AppSpacing.xxxl),

              // Primary CTA — barcode scanner
              _HomeCard(
                icon: Icons.qr_code_scanner,
                color: AppColors.primary,
                title: 'Scan barcode',
                subtitle: 'EAN-13, EAN-8, UPC — any product in India',
                onTap: () => context.go(AppRoutes.scanner),
              ),
              const SizedBox(height: AppSpacing.l),

              // Secondary CTA — label OCR (Phase 5)
              _HomeCard(
                icon: Icons.document_scanner_outlined,
                color: AppColors.accent,
                title: 'Scan nutrition label',
                subtitle: 'Photograph the nutrition facts panel',
                onTap: () => context.go(AppRoutes.scanner),
              ),
              const SizedBox(height: AppSpacing.l),

              // Household
              _HomeCard(
                icon: Icons.family_restroom,
                color: AppColors.scoreGood,
                title: 'Household',
                subtitle: 'Manage profiles for your family',
                onTap: () => context.go(AppRoutes.household),
              ),
            ],
          ),
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
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
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
                    Text(title, style: AppType.titleMedium),
                    const SizedBox(height: 2),
                    Text(subtitle, style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.subtle),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../components/buttons.dart';
import '../components/glass_card.dart';
import '../components/gradient_scaffold.dart';
import '../components/nutrient_ring.dart';
import '../components/nutrimind_logo.dart';
import '../components/shimmer_skeleton.dart';
import '../components/stat_chip.dart';
import '../theme.dart';
import '../app_palette.dart';
import '../tokens.dart';

/// Debug-only gallery — renders every design-system token and component in BOTH themes side by
/// side (Phase 0 gate G0). Never registered in release navigation (see router.dart's `kDebugMode`
/// guard) and never linked from any user-facing screen.
class DesignSystemGalleryScreen extends StatelessWidget {
  const DesignSystemGalleryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Design System Gallery (debug)'),
          bottom: const TabBar(tabs: [Tab(text: 'Light'), Tab(text: 'Dark')]),
        ),
        body: TabBarView(
          children: [
            Theme(data: _lightPreview, child: const _GalleryBody()),
            Theme(data: _darkPreview, child: const _GalleryBody()),
          ],
        ),
      ),
    );
  }
}

final _lightPreview = buildLightTheme();
final _darkPreview = buildDarkTheme();

class _GalleryBody extends StatelessWidget {
  const _GalleryBody();

  @override
  Widget build(BuildContext context) {
    return GradientScaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          children: [
            _Section('Typography', [
              Text('Display Large — 2,847 kcal', style: Theme.of(context).textTheme.displayLarge),
              Text('Headline — Today\'s Summary', style: Theme.of(context).textTheme.headlineMedium),
              Text('Body — Your protein intake is on track for today\'s goal.', style: Theme.of(context).textTheme.bodyLarge),
              Text('Label — SODIUM · 340mg', style: Theme.of(context).textTheme.labelMedium),
            ]),
            _Section('Colors (semantic)', [
              Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: [
                _Swatch('primary', Theme.of(context).colorScheme.primary),
                _Swatch('secondary', Theme.of(context).colorScheme.secondary),
                _Swatch('success', context.colors.success),
                _Swatch('warning', context.colors.warning),
                _Swatch('error', Theme.of(context).colorScheme.error),
                const _Swatch('scoreExcellent', AppColors.scoreExcellent),
                const _Swatch('scoreBad', AppColors.scoreBad),
              ]),
            ]),
            _Section('Buttons', [
              PrimaryButton(label: 'Primary Button', loading: false, disabled: false, onPressed: () {}),
              const SizedBox(height: AppSpacing.m),
              SecondaryButton(label: 'Secondary Button', loading: false, disabled: false, onPressed: () {}),
            ]),
            _Section('Glass card', [
              GlassCard(child: Text('Frosted glass surface', style: Theme.of(context).textTheme.bodyMedium)),
            ]),
            _Section('Stat chips', [
              Wrap(spacing: AppSpacing.s, children: [
                const StatChip(label: 'kcal today', value: '1,840', icon: Icons.local_fire_department),
                StatChip(label: 'sodium', value: '340mg', icon: Icons.water_drop_outlined, color: context.colors.warning),
              ]),
            ]),
            const _Section('Animated nutrient ring', [
              Row(children: [
                AnimatedNutrientRing(value: 78, maxValue: 100, color: AppColors.scoreGood, label: 'Health Score'),
                SizedBox(width: AppSpacing.xl),
                AnimatedNutrientRing(value: 34, maxValue: 100, color: AppColors.scorePoor, size: 100, label: 'Sugar'),
              ]),
            ]),
            const _Section('Shimmer skeleton', [
              ShimmerSkeleton(width: 200),
              SizedBox(height: AppSpacing.s),
              ShimmerSkeleton(width: 120, height: 24),
            ]),
            const _Section('NutriMind animated mark', [
              Wrap(spacing: AppSpacing.xl, children: [
                NutriMindLogo(state: NutriMindMoodState.idle),
                NutriMindLogo(state: NutriMindMoodState.listening),
                NutriMindLogo(state: NutriMindMoodState.celebrating),
              ]),
            ]),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.title, this.children);
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.m),
          ...children,
        ],
      ),
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch(this.label, this.color);
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(width: 56, height: 56, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(height: AppSpacing.xs),
        Text(label, style: Theme.of(context).textTheme.labelSmall),
      ],
    );
  }
}

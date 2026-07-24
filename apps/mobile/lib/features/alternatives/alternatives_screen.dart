import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Alternatives screen — ranked healthier swaps for the scanned product.
/// Gate: delta math displayed; budget option highlighted; thin-category handled honestly.
class AlternativesScreen extends StatelessWidget {
  final String originalName;
  final double originalScore;
  final List<Map<String, dynamic>> ranked;  // RankedAlternative list from API
  final bool thinCategory;
  final String? thinMessage;

  const AlternativesScreen({
    super.key,
    required this.originalName,
    required this.originalScore,
    required this.ranked,
    required this.thinCategory,
    this.thinMessage,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Healthier Alternatives')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: [
          _OriginalCard(name: originalName, score: originalScore),
          const SizedBox(height: AppSpacing.m),

          if (thinCategory && ranked.isEmpty) ...[
            _ThinCategoryCard(message: thinMessage),
          ] else ...[
            const Text('Better options', style: AppType.titleMedium),
            const SizedBox(height: AppSpacing.s),
            ...ranked.map((alt) => _AlternativeCard(alt: alt)),
          ],
        ],
      ),
    );
  }
}

class _OriginalCard extends StatelessWidget {
  final String name;
  final double score;

  const _OriginalCard({required this.name, required this.score});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Row(
          children: [
            const Icon(Icons.qr_code_scanner, size: 32),
            const SizedBox(width: AppSpacing.s),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Scanned product', style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
                  Text(name, style: AppType.titleMedium),
                ],
              ),
            ),
            _ScorePill(score: score, delta: null),
          ],
        ),
      ),
    );
  }
}

class _ThinCategoryCard extends StatelessWidget {
  final String? message;

  const _ThinCategoryCard({this.message});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: context.colors.surface,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Column(
          children: [
            Icon(Icons.info_outline, size: 40, color: context.colors.subtle),
            const SizedBox(height: AppSpacing.s),
            Text(
              message ?? 'No better-scoring alternatives found in this category.',
              style: AppType.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _AlternativeCard extends StatelessWidget {
  final Map<String, dynamic> alt;

  const _AlternativeCard({required this.alt});

  @override
  Widget build(BuildContext context) {
    final name        = alt['name'] as String? ?? 'Unknown';
    final brand       = alt['brand'] as String?;
    final score       = (alt['healthScore'] as num?)?.toDouble() ?? 0;
    final scoreDelta  = (alt['scoreDelta'] as num?)?.toDouble() ?? 0;
    final priceDelta  = (alt['priceDelta'] as num?)?.toDouble();
    final isBudget    = alt['isBudgetOption'] == true;
    final why         = alt['why'] as Map<String, dynamic>?;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      child: ExpansionTile(
        leading: _ScorePill(score: score, delta: scoreDelta),
        title: Text(name, style: AppType.bodyMedium),
        subtitle: Row(
          children: [
            if (brand != null) ...[
              Text(brand, style: AppType.bodySmall.copyWith(color: context.colors.subtle)),
              const SizedBox(width: AppSpacing.s),
            ],
            if (isBudget)
              const _Badge(label: 'Budget pick', color: AppColors.scoreGood),
          ],
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.m, 0, AppSpacing.m, AppSpacing.m),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Delta math row
                _DeltaRow(
                  label: 'Health score',
                  value: '${score.toStringAsFixed(0)}/100',
                  deltaStr: scoreDelta >= 0
                      ? '+${scoreDelta.toStringAsFixed(1)} pts'
                      : '${scoreDelta.toStringAsFixed(1)} pts',
                  positive: scoreDelta > 0,
                ),
                if (priceDelta != null)
                  _DeltaRow(
                    label: 'Price',
                    value: priceDelta >= 0
                        ? '₹${priceDelta.toStringAsFixed(0)} more'
                        : '₹${(-priceDelta).toStringAsFixed(0)} less',
                    deltaStr: priceDelta <= 0 ? 'saves money' : 'costs more',
                    positive: priceDelta <= 0,
                  ),
                if (why != null && why['reasons'] is List) ...[
                  const SizedBox(height: AppSpacing.xs),
                  ...(why['reasons'] as List<dynamic>)
                      .cast<String>()
                      .map((r) => Text('• $r', style: AppType.bodySmall)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  final double score;
  final double? delta;

  const _ScorePill({required this.score, required this.delta});

  @override
  Widget build(BuildContext context) {
    final color = score >= 80 ? AppColors.scoreExcellent
        : score >= 60 ? AppColors.scoreGood
        : score >= 40 ? AppColors.scoreFair
        : AppColors.scorePoor;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(score.toStringAsFixed(0), style: AppType.titleMedium.copyWith(color: color)),
        ),
        if (delta != null)
          Text(
            delta! >= 0 ? '+${delta!.toStringAsFixed(1)}' : delta!.toStringAsFixed(1),
            style: AppType.bodySmall.copyWith(
              color: delta! > 0 ? AppColors.scoreGood : AppColors.scorePoor,
            ),
          ),
      ],
    );
  }
}

class _DeltaRow extends StatelessWidget {
  final String label;
  final String value;
  final String deltaStr;
  final bool positive;

  const _DeltaRow({
    required this.label,
    required this.value,
    required this.deltaStr,
    required this.positive,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppType.bodySmall.copyWith(color: context.colors.subtle))),
          Text(value, style: AppType.bodySmall),
          const SizedBox(width: AppSpacing.xs),
          Text(
            '($deltaStr)',
            style: AppType.bodySmall.copyWith(
              color: positive ? AppColors.scoreGood : AppColors.scorePoor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;

  const _Badge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label, style: AppType.bodySmall.copyWith(color: color, fontWeight: FontWeight.w600)),
    );
  }
}

import 'package:flutter/material.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';

/// Grocery cart screen — shows cart score, expandable per-item math,
/// and family allergen conflicts (gate: 8-item cart + family rollup).
class CartScreen extends StatelessWidget {
  final Map<String, dynamic> cartRollup;  // CartRollupResult from API

  const CartScreen({super.key, required this.cartRollup});

  @override
  Widget build(BuildContext context) {
    final householdScore = (cartRollup['householdScore'] as num?)?.toDouble() ?? 0;
    final memberResults  = (cartRollup['memberResults'] as List<dynamic>?)
        ?.whereType<Map<String, dynamic>>()
        .toList() ?? [];
    final conflicts      = (cartRollup['conflictSummary'] as List<dynamic>?)
        ?.cast<String>() ?? [];
    final unsuppressible = (cartRollup['unsuppressibleConflicts'] as num?)?.toInt() ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Grocery Cart')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: [
          _HouseholdScoreCard(score: householdScore),
          const SizedBox(height: AppSpacing.m),

          // Allergen conflict section
          if (conflicts.isNotEmpty) ...[
            _AllergenConflictCard(
              conflicts: conflicts,
              unsuppressibleCount: unsuppressible,
            ),
            const SizedBox(height: AppSpacing.m),
          ],

          // Per-member cart breakdown
          const Text('Family breakdown', style: AppType.titleMedium),
          const SizedBox(height: AppSpacing.s),
          ...memberResults.map((m) => _MemberCartCard(member: m)),
        ],
      ),
    );
  }
}

// ── Household score card ────────────────────────────────────────────────────────

class _HouseholdScoreCard extends StatelessWidget {
  final double score;
  const _HouseholdScoreCard({required this.score});

  @override
  Widget build(BuildContext context) {
    final color = scoreColor(score);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Row(children: [
          Stack(alignment: Alignment.center, children: [
            SizedBox(
              width: 64,
              height: 64,
              child: CircularProgressIndicator(
                value: score / 100,
                strokeWidth: 6,
                backgroundColor: context.colors.divider,
                color: color,
              ),
            ),
            Text(score.toStringAsFixed(0), style: AppType.titleLarge.copyWith(color: color)),
          ]),
          const SizedBox(width: AppSpacing.l),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Family Cart Score', style: AppType.titleMedium),
                SizedBox(height: AppSpacing.xs),
                Text(
                  'Quantity-weighted average across all household members',
                  style: AppType.bodySmall,
                ),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Allergen conflict card ──────────────────────────────────────────────────────

class _AllergenConflictCard extends StatelessWidget {
  final List<String> conflicts;
  final int unsuppressibleCount;
  const _AllergenConflictCard({required this.conflicts, required this.unsuppressibleCount});

  @override
  Widget build(BuildContext context) {
    final hasUnsuppressible = unsuppressibleCount > 0;
    final color = hasUnsuppressible ? AppColors.scoreBad : context.colors.warning;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(120)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.no_food_outlined, color: color, size: 18),
            const SizedBox(width: AppSpacing.xs),
            Text(
              hasUnsuppressible
                  ? '$unsuppressibleCount allergen conflict${unsuppressibleCount > 1 ? 's' : ''} in this cart'
                  : 'Possible allergen conflicts',
              style: AppType.labelMedium.copyWith(color: color),
            ),
          ]),
          const SizedBox(height: AppSpacing.s),
          ...conflicts.map((c) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: Text('• $c', style: AppType.bodySmall.copyWith(color: color)),
          )),
        ],
      ),
    );
  }
}

// ── Per-member cart card ────────────────────────────────────────────────────────

class _MemberCartCard extends StatefulWidget {
  final Map<String, dynamic> member;
  const _MemberCartCard({required this.member});

  @override
  State<_MemberCartCard> createState() => _MemberCartCardState();
}

class _MemberCartCardState extends State<_MemberCartCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final memberName  = widget.member['memberName'] as String? ?? 'Member';
    final cartScore   = widget.member['cartScore'] as Map<String, dynamic>? ?? {};
    final score       = (cartScore['overallScore'] as num?)?.toDouble() ?? 0;
    final band        = cartScore['band'] as String? ?? 'fair';
    final items       = (cartScore['items'] as List<dynamic>?)
        ?.whereType<Map<String, dynamic>>()
        .toList() ?? [];
    final color       = _bandColor(band);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => setState(() => _expanded = !_expanded),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(child: Text(memberName, style: AppType.titleSmall)),
                Text(
                  '${score.toStringAsFixed(0)}/100',
                  style: AppType.titleSmall.copyWith(color: color),
                ),
                const SizedBox(width: AppSpacing.xs),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  size: 16,
                  color: context.colors.subtle,
                ),
              ]),
              if (_expanded) ...[
                const SizedBox(height: AppSpacing.m),
                const Text('Product scores (expandable math)', style: AppType.labelSmall),
                const SizedBox(height: AppSpacing.xs),
                ...items.map((item) => _CartItemRow(item: item)),
                const Divider(),
                Row(children: [
                  const Expanded(child: Text('Cart total', style: AppType.labelMedium)),
                  Text(
                    '${score.toStringAsFixed(1)}/100',
                    style: AppType.labelMedium.copyWith(color: color),
                  ),
                ]),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Score = Σ(product_score × quantity / total_units)',
                  style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _bandColor(String band) {
    switch (band) {
      case 'excellent': return AppColors.scoreExcellent;
      case 'good':      return AppColors.scoreGood;
      case 'fair':      return AppColors.scoreFair;
      case 'poor':      return AppColors.scorePoor;
      default:          return AppColors.scoreBad;
    }
  }
}

class _CartItemRow extends StatelessWidget {
  final Map<String, dynamic> item;
  const _CartItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final name         = item['productName'] as String? ?? '';
    final qty          = item['quantityUnits'] as int? ?? 1;
    final score        = (item['score'] as num?)?.toDouble() ?? 0;
    final weight       = (item['weight'] as num?)?.toDouble() ?? 0;
    final contribution = (item['contribution'] as num?)?.toDouble() ?? 0;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Expanded(
          child: Text(
            '$name (×$qty, ${(weight * 100).toStringAsFixed(0)}%)',
            style: AppType.bodySmall,
          ),
        ),
        Text(
          '${score.toStringAsFixed(0)} × ${weight.toStringAsFixed(3)} = ${contribution.toStringAsFixed(1)}',
          style: AppType.bodySmall.copyWith(color: context.colors.subtle, fontFamily: 'monospace'),
        ),
      ]),
    );
  }
}

import 'package:flutter/material.dart';
import '../../core/design_system/tokens.dart';

/// Meal log screen — shows all meals logged today with their nutrition totals.
/// Tapping a meal expands its nutrition breakdown.
class MealLogScreen extends StatelessWidget {
  final List<dynamic> entries;       // MealEntry[] from API
  final Map<String, dynamic>? total; // DailyNutritionTotal from API

  const MealLogScreen({super.key, required this.entries, this.total});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Today's Meals")),
      body: entries.isEmpty
          ? const Center(child: Text('No meals logged today. Scan a product to add one.'))
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.m),
              children: [
                if (total != null) _DayTotalCard(total: total!),
                const SizedBox(height: AppSpacing.m),
                const Text('Meals', style: AppType.titleMedium),
                const SizedBox(height: AppSpacing.s),
                ...entries.whereType<Map<String, dynamic>>().map(
                  (e) => _MealEntryCard(entry: e),
                ),
              ],
            ),
    );
  }
}

// ── Day total card ──────────────────────────────────────────────────────────────

class _DayTotalCard extends StatelessWidget {
  final Map<String, dynamic> total;
  const _DayTotalCard({required this.total});

  @override
  Widget build(BuildContext context) {
    final kcal   = total['energyKcal'] as num? ?? 0;
    final protein = total['proteinG'] as num? ?? 0;
    final sodium  = total['sodiumMg'] as num? ?? 0;
    final fibre   = total['dietaryFiberG'] as num? ?? 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Day's Total", style: AppType.titleMedium),
            const SizedBox(height: AppSpacing.m),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _StatPill(label: 'Calories', value: '${kcal.toStringAsFixed(0)} kcal'),
                _StatPill(label: 'Protein', value: '${protein.toStringAsFixed(1)}g'),
                _StatPill(label: 'Sodium', value: '${sodium.toStringAsFixed(0)} mg'),
                _StatPill(label: 'Fibre', value: '${fibre.toStringAsFixed(1)}g'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final String label;
  final String value;
  const _StatPill({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: AppType.titleSmall.copyWith(color: AppColors.primary)),
        Text(label, style: AppType.bodySmall.copyWith(color: AppColors.subtle)),
      ],
    );
  }
}

// ── Meal entry card ─────────────────────────────────────────────────────────────

class _MealEntryCard extends StatefulWidget {
  final Map<String, dynamic> entry;
  const _MealEntryCard({required this.entry});

  @override
  State<_MealEntryCard> createState() => _MealEntryCardState();
}

class _MealEntryCardState extends State<_MealEntryCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final name     = widget.entry['productName'] as String? ?? 'Unknown';
    final servingG = widget.entry['servingG'] as num? ?? 0;
    final n        = widget.entry['nutrition'] as Map<String, dynamic>? ?? {};
    final factor   = servingG / 100;

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
                Expanded(child: Text(name, style: AppType.titleSmall)),
                Text(
                  '${servingG.toStringAsFixed(0)}g',
                  style: AppType.bodySmall.copyWith(color: AppColors.subtle),
                ),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  size: 16,
                  color: AppColors.subtle,
                ),
              ]),
              if (_expanded) ...[
                const SizedBox(height: AppSpacing.s),
                _NutritionRow('Calories', _fmt((n['energyKcal'] as num?)?.toDouble(), factor), 'kcal'),
                _NutritionRow('Protein', _fmt((n['proteinG'] as num?)?.toDouble(), factor), 'g'),
                _NutritionRow('Fat', _fmt((n['fatTotalG'] as num?)?.toDouble(), factor), 'g'),
                _NutritionRow('Carbohydrates', _fmt((n['carbohydratesG'] as num?)?.toDouble(), factor), 'g'),
                _NutritionRow('Sodium', _fmtInt((n['sodiumMg'] as num?)?.toDouble(), factor), 'mg'),
                _NutritionRow('Fibre', _fmt((n['dietaryFiberG'] as num?)?.toDouble(), factor), 'g'),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _fmt(double? val, double factor) =>
      val != null ? (val * factor).toStringAsFixed(1) : '—';

  String _fmtInt(double? val, double factor) =>
      val != null ? (val * factor).toStringAsFixed(0) : '—';
}

class _NutritionRow extends StatelessWidget {
  final String label;
  final String value;
  final String unit;
  const _NutritionRow(this.label, this.value, this.unit);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(children: [
        Expanded(child: Text(label, style: AppType.bodySmall)),
        Text('$value $unit', style: AppType.bodySmall.copyWith(fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

import 'package:flutter/material.dart';
import '../../core/design_system/tokens.dart';

/// Daily nutrition dashboard — visualises nutrient gaps vs budget.
/// Shows progress bars for key nutrients; tapping any bar shows the full breakdown.
class DailyDashboard extends StatelessWidget {
  final Map<String, dynamic> gapReport;  // DailyGapReport from API

  const DailyDashboard({super.key, required this.gapReport});

  @override
  Widget build(BuildContext context) {
    final memberName = gapReport['memberName'] as String? ?? 'You';
    final date       = gapReport['date'] as String? ?? '';
    final gaps       = (gapReport['gaps'] as List<dynamic>?)
        ?.whereType<Map<String, dynamic>>()
        .toList() ?? [];
    final overall    = gapReport['overallStatus'] as String? ?? 'on_track';

    return Scaffold(
      appBar: AppBar(title: Text('$memberName — $date')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: [
          _OverallStatusCard(status: overall),
          const SizedBox(height: AppSpacing.m),
          ...gaps.map((g) => _NutrientGapBar(gap: g)),
        ],
      ),
    );
  }
}

class _OverallStatusCard extends StatelessWidget {
  final String status;
  const _OverallStatusCard({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, icon, label) = switch (status) {
      'on_track' => (AppColors.scoreGood, Icons.check_circle_outline, 'On track today'),
      'over'     => (AppColors.scorePoor, Icons.warning_amber_outlined, 'Over limit in some nutrients'),
      _          => (AppColors.scoreFair, Icons.info_outline, 'Under target in some nutrients'),
    };

    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Icon(icon, color: color),
        const SizedBox(width: AppSpacing.s),
        Text(label, style: AppType.titleSmall.copyWith(color: color)),
      ]),
    );
  }
}

class _NutrientGapBar extends StatelessWidget {
  final Map<String, dynamic> gap;
  const _NutrientGapBar({required this.gap});

  @override
  Widget build(BuildContext context) {
    final nutrient    = gap['nutrient'] as String? ?? '';
    final consumed    = (gap['consumed'] as num?)?.toDouble() ?? 0;
    final budget      = (gap['budget'] as num?)?.toDouble() ?? 1;
    final pct         = (gap['pctOfBudget'] as num?)?.toInt() ?? 0;
    final status      = gap['status'] as String? ?? 'on_track';
    final unit        = gap['unit'] as String? ?? '';

    final fraction = (consumed / budget).clamp(0.0, 1.5);
    final color = _statusColor(status);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text(nutrient, style: AppType.labelMedium)),
            Text(
              '${consumed.toStringAsFixed(unit == 'mg' ? 0 : 1)}$unit / ${budget.toStringAsFixed(unit == 'mg' ? 0 : 0)}$unit',
              style: AppType.bodySmall.copyWith(color: AppColors.subtle),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text('$pct%', style: AppType.labelSmall.copyWith(color: color)),
          ]),
          const SizedBox(height: AppSpacing.xs),
          LinearProgressIndicator(
            value: fraction.clamp(0.0, 1.0),
            backgroundColor: AppColors.divider,
            color: color,
            minHeight: 6,
            borderRadius: BorderRadius.circular(3),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'on_track': return AppColors.scoreGood;
      case 'over':     return AppColors.scorePoor;
      default:         return AppColors.scoreFair;
    }
  }
}
